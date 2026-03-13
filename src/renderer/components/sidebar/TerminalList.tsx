/**
 * TerminalList — renders clickable terminal session entries under a project.
 * Clicking a session makes it the active (visible) terminal in the workspace.
 * Double-clicking the name enters inline rename mode.
 */

import { useState, useRef, useEffect } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { TerminalSession } from '../../../shared/types'
import { cn } from '@/lib/utils'
import { Terminal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TerminalListProps {
  sessions: TerminalSession[]
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function TerminalList({ sessions, terminalManager }: TerminalListProps) {
  const { state, setActiveTerminal, removeSession, renameSession, reviveSession } =
    useTerminalContext()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when entering edit mode.
  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingId])

  if (sessions.length === 0) return null

  const handleKill = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    terminalManager.destroyTerminal(sessionId)
    removeSession(sessionId)
  }

  const startRename = (session: TerminalSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditValue(session.name)
  }

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renameSession(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  return (
    <div className="ml-3 border-l border-border pl-2 space-y-0.5">
      {sessions.map((session) => {
        const isActive = state.activeTerminalId === session.id
        const isEditing = editingId === session.id

        return (
          <div
            key={session.id}
            className={cn(
              'flex items-center justify-between px-2 py-1 rounded cursor-pointer group text-xs',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
            onClick={() => {
              setActiveTerminal(session.id)
              // Auto-spawn a shell for restored sessions that aren't running yet.
              if (!session.isRunning) {
                const project = state.projects.find((p) => p.id === session.projectId)
                if (project) {
                  reviveSession(session.id)
                  terminalManager.restartTerminal(session.id, project.path)
                }
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="h-3 w-3 shrink-0" />

              {isEditing ? (
                <input
                  ref={inputRef}
                  className="bg-background border border-border rounded px-1 py-0 text-xs text-foreground w-full outline-none focus:ring-1 focus:ring-accent"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate" onDoubleClick={(e) => startRename(session, e)}>
                  {session.name}
                </span>
              )}

              {/* Status dot */}
              {!isEditing && (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    session.isRunning ? 'bg-green-500' : 'bg-zinc-500'
                  )}
                />
              )}
            </div>
            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => handleKill(session.id, e)}
                title="Kill Terminal"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
