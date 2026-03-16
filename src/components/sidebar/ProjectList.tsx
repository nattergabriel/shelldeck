/**
 * ProjectList — renders each project with its terminal sessions.
 * Projects can be reordered via pointer-based drag-and-drop.
 * Double-click a project name to rename. Right-click for a context menu.
 */

import { useState } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { useInlineRename } from '@/hooks/use-inline-rename'
import { useDragReorder } from '@/hooks/use-drag-reorder'
import { TerminalList } from './TerminalList'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { Plus, Folder, AlertTriangle, ChevronRight } from 'lucide-react'
import { pathExists } from '@/lib/api'
import { confirm } from '@tauri-apps/plugin-dialog'
import { open } from '@tauri-apps/plugin-shell'

export function ProjectList() {
  const { state, createSession, removeProject, reorderProjects, renameProject } =
    useTerminalContext()
  const terminalManager = useTerminalManager()
  const rename = useInlineRename(renameProject)
  const drag = useDragReorder(reorderProjects)

  const [invalidPaths, setInvalidPaths] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    projectId: string
  } | null>(null)

  const contextProject = contextMenu
    ? state.projects.find((p) => p.id === contextMenu.projectId)
    : null

  const toggleCollapsed = (projectId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const handleNewTerminal = async (projectId: string, projectPath: string) => {
    const exists = await pathExists(projectPath)
    if (!exists) {
      setInvalidPaths((prev) => new Set(prev).add(projectId))
      return
    }
    setInvalidPaths((prev) => {
      const next = new Set(prev)
      next.delete(projectId)
      return next
    })
    const sessionId = createSession(projectId)
    terminalManager.createTerminal(sessionId, projectPath)
  }

  const handleRemove = async (projectId: string, projectName: string) => {
    const ok = await confirm(`Remove "${projectName}" and all its terminals?`, {
      title: 'Remove Project',
      kind: 'warning'
    })
    if (ok) removeProject(projectId)
  }

  return (
    <div className="space-y-0.5">
      {state.projects.map((project, index) => {
        const sessions = state.sessions.filter((s) => s.projectId === project.id)
        const isInvalid = invalidPaths.has(project.id)
        const isCollapsed = collapsed.has(project.id)
        const isDragging = drag.dragging === index
        const showIndicatorBefore =
          drag.dropTarget === index && drag.dragging !== null && drag.dragging !== index
        const isEditing = rename.editingId === project.id

        return (
          <div key={project.id} ref={(el) => drag.registerRef(index, el)}>
            {showIndicatorBefore && (
              <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mb-0.5" />
            )}

            {/* Project header */}
            <div
              className={`flex items-center justify-between px-2 py-1.5 rounded-md group hover:bg-accent transition-colors cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
              onPointerDown={(e) => {
                if (e.button !== 0 || (e.target as HTMLElement).closest('button, input')) return
                if (rename.editingId) return
                e.preventDefault()
                drag.startDrag(index)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, projectId: project.id })
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  className="h-6 w-6 -ml-0.5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground rounded"
                  onClick={() => toggleCollapsed(project.id)}
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  />
                </button>
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                {isEditing ? (
                  <input
                    {...rename.inputProps}
                    className="bg-background border border-border rounded px-2 py-0.5 text-sm text-foreground w-full outline-none"
                  />
                ) : (
                  <span
                    className="text-sm text-foreground truncate"
                    onDoubleClick={() => rename.start(project.id, project.name)}
                  >
                    {project.name}
                  </span>
                )}
              </div>
              {!isEditing && (
                <button
                  className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-secondary"
                  onClick={() => handleNewTerminal(project.id, project.path)}
                  title="New Terminal"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isInvalid && (
              <div className="flex items-center gap-1.5 px-2 py-1 ml-6 text-xs text-yellow-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Path not found</span>
              </div>
            )}

            {!isCollapsed && <TerminalList sessions={sessions} />}

            {/* Show indicator after the last item if dropping at the end */}
            {drag.dropTarget === state.projects.length &&
              index === state.projects.length - 1 &&
              drag.dragging !== null &&
              drag.dragging !== state.projects.length - 1 && (
                <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mt-0.5" />
              )}
          </div>
        )
      })}

      {/* Context menu */}
      {contextMenu && contextProject && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <ContextMenuItem
            onClick={() => {
              rename.start(contextProject.id, contextProject.name)
              setContextMenu(null)
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              handleNewTerminal(contextProject.id, contextProject.path)
              setContextMenu(null)
            }}
          >
            New Terminal
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              open(contextProject.path)
              setContextMenu(null)
            }}
          >
            Open in Finder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            destructive
            onClick={() => {
              handleRemove(contextProject.id, contextProject.name)
              setContextMenu(null)
            }}
          >
            Remove
          </ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  )
}
