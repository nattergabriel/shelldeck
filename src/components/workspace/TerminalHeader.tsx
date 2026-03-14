/**
 * TerminalHeader — displays the terminal name, status, and action buttons
 * (Restart, Kill) above the active terminal view.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { TerminalSession } from '@/types'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'

interface TerminalHeaderProps {
  session: TerminalSession
  projectPath: string
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function TerminalHeader({ session, projectPath, terminalManager }: TerminalHeaderProps) {
  const { dispatch } = useTerminalContext()

  const handleRestart = () => {
    dispatch({ type: 'SET_SESSION_RUNNING', sessionId: session.id, isRunning: true })
    terminalManager.restartTerminal(session.id, projectPath)
  }

  return (
    <div
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{session.name}</span>
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
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restart
      </button>
    </div>
  )
}
