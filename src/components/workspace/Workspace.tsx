/**
 * Workspace — main content area displaying terminal sessions.
 *
 * Renders the split pane layout when terminals are visible, or the idle screen
 * when no layout exists. Hidden terminals are still mounted (display: none)
 * to preserve xterm.js output.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { getAllSessionIds } from '@/lib/layout'
import { getHomeDir } from '@/lib/api'
import { SplitPaneContainer } from './SplitPaneContainer'
import { TerminalView } from './TerminalView'
import { IdleScreen } from './IdleScreen'

export function Workspace() {
  const { state, reviveSession } = useTerminalContext()
  const terminalManager = useTerminalManager()
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd+F toggles the search bar.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close search when switching terminals.
  useEffect(() => {
    setSearchOpen(false)
  }, [state.activeTerminalId])

  // Auto-restart dead sessions when they become active.
  const prevActiveId = useRef(state.activeTerminalId)
  useEffect(() => {
    if (state.activeTerminalId && state.activeTerminalId !== prevActiveId.current) {
      const session = state.sessions.find((s) => s.id === state.activeTerminalId)
      if (session && !session.isRunning) {
        if (session.workspaceId) {
          const workspace = state.workspaces.find((w) => w.id === session.workspaceId)
          if (workspace) {
            reviveSession(session.id)
            terminalManager.restartTerminal(session.id, workspace.path)
          }
        } else {
          getHomeDir().then((home) => {
            reviveSession(session.id)
            terminalManager.restartTerminal(session.id, home)
          })
        }
      }
    }
    prevActiveId.current = state.activeTerminalId
  }, [state.activeTerminalId, state.sessions, state.workspaces, reviveSession, terminalManager])

  const visibleIds = useMemo(
    () => (state.layout ? new Set(getAllSessionIds(state.layout)) : new Set<string>()),
    [state.layout]
  )

  const hiddenSessions = useMemo(
    () => state.sessions.filter((s) => !visibleIds.has(s.id)),
    [state.sessions, visibleIds]
  )

  if (!state.layout) {
    return <IdleScreen />
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="flex-1 relative overflow-clip flex">
        <SplitPaneContainer
          layout={state.layout}
          path={[]}
          searchOpen={searchOpen}
          onCloseSearch={() => setSearchOpen(false)}
        />
      </div>

      {/* Hidden terminals — preserve xterm output when not in layout */}
      {hiddenSessions.map((session) => (
        <div key={session.id} className="absolute" style={{ display: 'none' }}>
          <TerminalView sessionId={session.id} isVisible={false} />
        </div>
      ))}
    </div>
  )
}
