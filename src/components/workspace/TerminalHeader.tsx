/**
 * TerminalHeader — displays the terminal name, status, and restart button
 * above the active terminal view.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import type { TerminalSession } from '@/types'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'

interface TerminalHeaderProps {
  session: TerminalSession
  workspacePath: string
}

export function TerminalHeader({ session, workspacePath }: TerminalHeaderProps) {
  const { reviveSession } = useTerminalContext()
  const terminalManager = useTerminalManager()

  const handleRestart = () => {
    reviveSession(session.id)
    terminalManager.restartTerminal(session.id, workspacePath)
  }

  return (
    <div
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3 min-w-0 pointer-events-none">
        <span className="text-sm font-medium text-foreground truncate">
          {terminalManager.terminalTitles[session.id] || session.name}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs',
            session.isRunning ? 'text-green-400' : 'text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              session.isRunning ? 'bg-green-500' : 'bg-muted-foreground/40'
            )}
          />
          {session.isRunning ? 'Running' : 'Exited'}
        </span>
      </div>

      <button
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
        onClick={handleRestart}
        title="Restart Terminal"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restart
      </button>
    </div>
  )
}
