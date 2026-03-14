/**
 * StatusBar — global bottom bar showing active session count,
 * system resource usage, and an emergency kill-all button.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useSystemStats } from '@/hooks/use-system-stats'
import { Button } from '@/components/ui/button'
import { Cpu, MemoryStick, OctagonX } from 'lucide-react'
import { killAllPtys } from '@/lib/api'

export function StatusBar() {
  const { state } = useTerminalContext()
  const stats = useSystemStats()

  const activeSessions = state.sessions.filter((s) => s.isRunning).length
  const totalSessions = state.sessions.length

  const handleStopAll = () => {
    killAllPtys()
  }

  return (
    <footer className="flex items-center justify-between px-4 py-1 border-t border-border bg-background text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          {activeSessions} active / {totalSessions} total
        </span>
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          {stats.cpuUsage}%
        </span>
        <span className="flex items-center gap-1">
          <MemoryStick className="h-3 w-3" />
          {stats.memoryUsedGB}GB / {stats.memoryTotalGB}GB ({stats.memoryUsage}%)
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-6"
        onClick={handleStopAll}
      >
        <OctagonX className="h-3.5 w-3.5" />
        STOP ALL
      </Button>
    </footer>
  )
}
