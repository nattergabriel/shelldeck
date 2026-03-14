/**
 * ProjectList — renders each project with its terminal sessions.
 * Projects can be reordered via pointer-based drag-and-drop.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { TerminalList } from './TerminalList'
import { useTerminalManager } from '@/hooks/use-terminal'
import { Plus, Folder, X, AlertTriangle } from 'lucide-react'
import { pathExists } from '@/lib/api'

interface ProjectListProps {
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function ProjectList({ terminalManager }: ProjectListProps) {
  const { state, createSession, removeProject, reorderProjects } = useTerminalContext()
  const [invalidPaths, setInvalidPaths] = useState<Set<string>>(new Set())

  // Drag state
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

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

  const findDropIndex = useCallback(
    (clientY: number): number | null => {
      let closest: { index: number; distance: number } | null = null
      for (const [index, el] of itemRefs.current) {
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const distance = Math.abs(clientY - mid)
        if (!closest || distance < closest.distance) {
          closest = { index: clientY < mid ? index : index + 1, distance }
        }
      }
      return closest?.index ?? null
    },
    []
  )

  useEffect(() => {
    if (dragging === null) return

    const onPointerMove = (e: PointerEvent) => {
      const target = findDropIndex(e.clientY)
      setDropTarget(target)
    }

    const onPointerUp = () => {
      if (dragging !== null && dropTarget !== null) {
        const to = dropTarget > dragging ? dropTarget - 1 : dropTarget
        if (to !== dragging) {
          reorderProjects(dragging, to)
        }
      }
      setDragging(null)
      setDropTarget(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, dropTarget, findDropIndex, reorderProjects])

  return (
    <div className="space-y-0.5">
      {state.projects.map((project, index) => {
        const sessions = state.sessions.filter((s) => s.projectId === project.id)
        const isInvalid = invalidPaths.has(project.id)
        const isDragging = dragging === index
        const showIndicatorBefore = dropTarget === index && dragging !== null && dragging !== index

        return (
          <div
            key={project.id}
            ref={(el) => {
              if (el) itemRefs.current.set(index, el)
              else itemRefs.current.delete(index)
            }}
          >
            {showIndicatorBefore && (
              <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mb-0.5" />
            )}

            {/* Project header */}
            <div
              className={`flex items-center justify-between px-2 py-1.5 rounded-md group hover:bg-accent transition-colors cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
              onPointerDown={(e) => {
                // Only start drag on left click and not on buttons
                if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
                e.preventDefault()
                setDragging(index)
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate">{project.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-secondary"
                  onClick={() => handleNewTerminal(project.id, project.path)}
                  title="New Terminal"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-secondary"
                  onClick={() => removeProject(project.id)}
                  title="Remove Project"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isInvalid && (
              <div className="flex items-center gap-1.5 px-2 py-1 ml-6 text-xs text-yellow-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Path not found</span>
              </div>
            )}

            <TerminalList sessions={sessions} terminalManager={terminalManager} />

            {/* Show indicator after the last item if dropping at the end */}
            {dropTarget === state.projects.length &&
              index === state.projects.length - 1 &&
              dragging !== null &&
              dragging !== state.projects.length - 1 && (
                <div className="h-0.5 bg-foreground/30 rounded-full mx-2 mt-0.5" />
              )}
          </div>
        )
      })}
    </div>
  )
}
