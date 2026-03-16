/**
 * Workspace — main content area displaying the active terminal session.
 *
 * All terminal containers are rendered simultaneously but only the active
 * one is visible (display: block vs. none). This keeps xterm.js instances
 * alive so no output is lost when switching sessions.
 */

import { useState, useEffect, useRef } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { TerminalHeader } from './TerminalHeader'
import { TerminalView } from './TerminalView'
import { SearchBar } from './SearchBar'
import { IdleScreen } from './IdleScreen'

export function Workspace() {
  const { state, reviveSession } = useTerminalContext()
  const terminalManager = useTerminalManager()
  const [searchOpen, setSearchOpen] = useState(false)
  const activeSession = state.sessions.find((s) => s.id === state.activeTerminalId)
  const activeWorkspace = activeSession
    ? state.workspaces.find((w) => w.id === activeSession.workspaceId)
    : null

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
        const workspace = state.workspaces.find((w) => w.id === session.workspaceId)
        if (workspace) {
          reviveSession(session.id)
          terminalManager.restartTerminal(session.id, workspace.path)
        }
      }
    }
    prevActiveId.current = state.activeTerminalId
  }, [state.activeTerminalId, state.sessions, state.workspaces, reviveSession, terminalManager])

  if (!state.activeTerminalId) {
    return <IdleScreen />
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {activeSession && activeWorkspace && (
        <TerminalHeader session={activeSession} workspacePath={activeWorkspace.path} />
      )}

      {searchOpen && state.activeTerminalId && (
        <SearchBar sessionId={state.activeTerminalId} onClose={() => setSearchOpen(false)} />
      )}

      <div className="flex-1 relative overflow-hidden">
        {state.sessions.map((session) => (
          <div
            key={session.id}
            className="absolute inset-0"
            style={{ display: session.id === state.activeTerminalId ? 'block' : 'none' }}
          >
            <TerminalView
              sessionId={session.id}
              isVisible={session.id === state.activeTerminalId}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
