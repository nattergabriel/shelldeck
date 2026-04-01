/**
 * TerminalHeader — displays the terminal name above a terminal pane.
 * Shows split and close buttons.
 */

import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import type { TerminalSession } from '@/types'
import { Columns2, Rows2, X } from 'lucide-react'

interface TerminalHeaderProps {
  session: TerminalSession
  showClosePane?: boolean
}

export function TerminalHeader({ session, showClosePane }: TerminalHeaderProps) {
  const terminalManager = useTerminalManager()
  const { splitFocusedPane, closePane } = useTerminalContext()

  const btnClass =
    'h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'

  return (
    <div
      className="flex items-center justify-between px-4 h-10 border-b border-border bg-card shrink-0"
      data-tauri-drag-region
    >
      <span className="text-sm font-medium text-foreground truncate pointer-events-none">
        {terminalManager.terminalTitles[session.id] || session.name}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          className={btnClass}
          onClick={() => splitFocusedPane('horizontal')}
          title="Split Right (⌘D)"
        >
          <Columns2 className="h-3.5 w-3.5" />
        </button>
        <button
          className={btnClass}
          onClick={() => splitFocusedPane('vertical')}
          title="Split Down (⌘⇧D)"
        >
          <Rows2 className="h-3.5 w-3.5" />
        </button>
        {showClosePane && (
          <button className={btnClass} onClick={() => closePane(session.id)} title="Close Pane">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
