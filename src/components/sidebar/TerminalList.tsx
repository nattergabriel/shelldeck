/**
 * TerminalList — renders clickable terminal session entries under a project.
 * Clicking a session makes it the active (visible) terminal in the workspace.
 * Double-clicking the name enters inline rename mode.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { useInlineRename } from '@/hooks/use-inline-rename'
import type { TerminalSession } from '@/types'
import { cn } from '@/lib/utils'
import { Terminal, X, Bell } from 'lucide-react'

interface TerminalListProps {
  sessions: TerminalSession[]
}

export function TerminalList({ sessions }: TerminalListProps) {
  const { state, setActiveTerminal, removeSession, renameSession } = useTerminalContext()
  const terminalManager = useTerminalManager()
  const rename = useInlineRename(renameSession)

  if (sessions.length === 0) return null

  const handleKill = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    terminalManager.destroyTerminal(sessionId)
    removeSession(sessionId)
  }

  return (
    <div className="ml-6 space-y-0.5 mt-0.5 mb-1">
      {sessions.map((session) => {
        const isActive = state.activeTerminalId === session.id
        const isEditing = rename.editingId === session.id
        const hasBell = state.bellSessionIds.has(session.id)

        return (
          <div
            key={session.id}
            className={cn(
              'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group text-sm transition-colors',
              isActive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            onMouseDown={(e) => {
              if (!(e.target as HTMLElement).closest('button, input')) e.preventDefault()
            }}
            onClick={() => setActiveTerminal(session.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Terminal
                className={cn('h-3.5 w-3.5 shrink-0', session.isRunning ? 'text-green-500' : '')}
              />

              {hasBell && <Bell className="h-3 w-3 shrink-0 text-yellow-500" />}

              {isEditing ? (
                <input
                  {...rename.inputProps}
                  className="bg-background border border-border rounded px-2 py-0.5 text-sm text-foreground w-full outline-none"
                />
              ) : (
                <span
                  className="truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    rename.start(session.id, session.name)
                  }}
                >
                  {session.name}
                </span>
              )}
            </div>
            {!isEditing && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => handleKill(session.id, e)}
                title="Kill Terminal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
