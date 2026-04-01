/**
 * TerminalList — renders clickable terminal session entries under a workspace.
 * Clicking a session makes it the active (visible) terminal in the workspace.
 * Double-clicking the name enters inline rename mode.
 */

import { useMemo } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { useInlineRename } from '@/hooks/use-inline-rename'
import { getAllSessionIds } from '@/lib/layout'
import type { TerminalSession } from '@/types'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Menu } from '@tauri-apps/api/menu'

interface TerminalListProps {
  sessions: TerminalSession[]
}

export function TerminalList({ sessions }: TerminalListProps) {
  const { state, setActiveTerminal, removeSession, renameSession } = useTerminalContext()
  const terminalManager = useTerminalManager()
  const rename = useInlineRename(renameSession)
  const layoutSessionIds = useMemo(
    () => (state.layout ? new Set(getAllSessionIds(state.layout)) : new Set<string>()),
    [state.layout]
  )

  if (sessions.length === 0) return null

  const handleKill = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    terminalManager.destroyTerminal(sessionId)
    removeSession(sessionId)
  }

  return (
    <div className="space-y-0.5 mt-0.5 mb-1">
      {sessions.map((session) => {
        const isFocused = state.activeTerminalId === session.id
        const isInLayout = !isFocused && layoutSessionIds.has(session.id)
        const isEditing = rename.editingId === session.id
        const hasBell = state.bellSessionIds.has(session.id)

        return (
          <div
            key={session.id}
            className={cn(
              'flex items-center justify-between pl-8 pr-2 py-1.5 rounded-md cursor-pointer group text-sm font-medium transition-colors',
              isFocused
                ? 'bg-accent text-foreground'
                : isInLayout
                  ? 'bg-accent/40 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            onMouseDown={(e) => {
              if (!(e.target as HTMLElement).closest('button, input')) e.preventDefault()
            }}
            onClick={() => setActiveTerminal(session.id)}
            onContextMenu={async (e) => {
              e.preventDefault()
              const menu = await Menu.new({
                items: [
                  { text: 'Rename', action: () => rename.start(session.id, session.name) },
                  { item: 'Separator' },
                  { text: 'Close Terminal', action: () => handleKill(session.id) }
                ]
              })
              await menu.popup()
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  hasBell
                    ? 'bg-yellow-500'
                    : session.isRunning
                      ? 'bg-green-500'
                      : 'bg-muted-foreground/40'
                )}
              />

              {isEditing ? (
                <input
                  {...rename.inputProps}
                  className="bg-background border border-border rounded px-2 py-0.5 text-sm text-foreground w-full outline-none"
                />
              ) : (
                <>
                  <span
                    className="truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      rename.start(session.id, session.name)
                    }}
                  >
                    {session.name}
                  </span>
                </>
              )}
            </div>
            {!isEditing && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => handleKill(session.id, e)}
                title="Close Terminal"
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
