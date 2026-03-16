/**
 * WorkspaceList — renders each workspace with its terminal sessions.
 * Workspaces can be reordered via pointer-based drag-and-drop.
 * Double-click a workspace name to rename. Right-click for a context menu.
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

export function WorkspaceList() {
  const { state, createSession, removeWorkspace, reorderWorkspaces, renameWorkspace } =
    useTerminalContext()
  const terminalManager = useTerminalManager()
  const rename = useInlineRename(renameWorkspace)
  const drag = useDragReorder(reorderWorkspaces)

  const [invalidPaths, setInvalidPaths] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    workspaceId: string
  } | null>(null)

  const contextWorkspace = contextMenu
    ? state.workspaces.find((w) => w.id === contextMenu.workspaceId)
    : null

  const toggleCollapsed = (workspaceId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(workspaceId)) next.delete(workspaceId)
      else next.add(workspaceId)
      return next
    })
  }

  const handleNewTerminal = async (workspaceId: string, workspacePath: string) => {
    const exists = await pathExists(workspacePath)
    if (!exists) {
      setInvalidPaths((prev) => new Set(prev).add(workspaceId))
      return
    }
    setInvalidPaths((prev) => {
      const next = new Set(prev)
      next.delete(workspaceId)
      return next
    })
    const sessionId = createSession(workspaceId)
    terminalManager.createTerminal(sessionId, workspacePath)
  }

  const handleRemove = async (workspaceId: string, workspaceName: string) => {
    const ok = await confirm(`Remove "${workspaceName}" and all its terminals?`, {
      title: 'Remove Workspace',
      kind: 'warning'
    })
    if (ok) removeWorkspace(workspaceId)
  }

  return (
    <div className="space-y-0.5">
      {state.workspaces.map((workspace, index) => {
        const sessions = state.sessions.filter((s) => s.workspaceId === workspace.id)
        const isInvalid = invalidPaths.has(workspace.id)
        const isCollapsed = collapsed.has(workspace.id)
        const isDragging = drag.dragging === index
        const showIndicatorBefore =
          drag.dropTarget === index && drag.dragging !== null && drag.dragging !== index
        const isEditing = rename.editingId === workspace.id

        return (
          <div key={workspace.id} ref={(el) => drag.registerRef(index, el)}>
            {showIndicatorBefore && (
              <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mb-0.5" />
            )}

            {/* Workspace header */}
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
                setContextMenu({ x: e.clientX, y: e.clientY, workspaceId: workspace.id })
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  className="h-6 w-6 -ml-0.5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground rounded"
                  onClick={() => toggleCollapsed(workspace.id)}
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
                    onDoubleClick={() => rename.start(workspace.id, workspace.name)}
                  >
                    {workspace.name}
                  </span>
                )}
              </div>
              {!isEditing && (
                <button
                  className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-secondary"
                  onClick={() => handleNewTerminal(workspace.id, workspace.path)}
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
            {drag.dropTarget === state.workspaces.length &&
              index === state.workspaces.length - 1 &&
              drag.dragging !== null &&
              drag.dragging !== state.workspaces.length - 1 && (
                <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mt-0.5" />
              )}
          </div>
        )
      })}

      {/* Context menu */}
      {contextMenu && contextWorkspace && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <ContextMenuItem
            onClick={() => {
              rename.start(contextWorkspace.id, contextWorkspace.name)
              setContextMenu(null)
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              handleNewTerminal(contextWorkspace.id, contextWorkspace.path)
              setContextMenu(null)
            }}
          >
            New Terminal
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              open(contextWorkspace.path)
              setContextMenu(null)
            }}
          >
            Open in Finder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            destructive
            onClick={() => {
              handleRemove(contextWorkspace.id, contextWorkspace.name)
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
