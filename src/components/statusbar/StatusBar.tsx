/**
 * StatusBar — global bottom bar showing active session count,
 * system resource usage, and an emergency kill-all button.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useSystemStats } from '@/hooks/use-system-stats'
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
    <footer className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          {activeSessions} active / {totalSessions} total
        </span>
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          {stats.cpuUsage}%
        </span>
        <span className="flex items-center gap-1.5">
          <MemoryStick className="h-3.5 w-3.5" />
          {stats.memoryUsedGB}GB / {stats.memoryTotalGB}GB ({stats.memoryUsage}%)
        </span>
      </div>

      <button
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
        onClick={handleStopAll}
      >
        <OctagonX className="h-3.5 w-3.5" />
        STOP ALL
      </button>
    </footer>
  )
}
