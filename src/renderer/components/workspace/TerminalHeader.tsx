/**
 * TerminalHeader — displays the terminal name, status, and action buttons
 * (Restart, Kill) above the active terminal view.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { TerminalSession } from '../../../shared/types'
import { Button } from '@/components/ui/button'
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
    <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-background draggable-region">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{session.name}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs',
            session.isRunning ? 'text-green-500' : 'text-zinc-500'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              session.isRunning ? 'bg-green-500' : 'bg-zinc-500'
            )}
          />
          {session.isRunning ? 'Running' : 'Exited'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleRestart}>
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </Button>
      </div>
    </div>
  )
}
