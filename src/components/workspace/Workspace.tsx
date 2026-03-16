/**
 * Workspace — main content area displaying the active terminal session.
 *
 * All terminal containers are rendered simultaneously but only the active
 * one is visible (display: block vs. none). This keeps xterm.js instances
 * alive so no output is lost when switching sessions.
 */

import { useState, useEffect, useRef } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { TerminalHeader } from './TerminalHeader'
import { TerminalView } from './TerminalView'
import { SearchBar } from './SearchBar'
import { IdleScreen } from './IdleScreen'

interface WorkspaceProps {
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function Workspace({ terminalManager }: WorkspaceProps) {
  const { state, reviveSession } = useTerminalContext()
  const [searchOpen, setSearchOpen] = useState(false)
  const activeSession = state.sessions.find((s) => s.id === state.activeTerminalId)
  const activeProject = activeSession
    ? state.projects.find((p) => p.id === activeSession.projectId)
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

  // Auto-restart dead sessions when they become active (e.g. after
  // closing a terminal and the reducer selects a sibling).
  const prevActiveId = useRef(state.activeTerminalId)
  useEffect(() => {
    if (state.activeTerminalId && state.activeTerminalId !== prevActiveId.current) {
      const session = state.sessions.find((s) => s.id === state.activeTerminalId)
      if (session && !session.isRunning) {
        const project = state.projects.find((p) => p.id === session.projectId)
        if (project) {
          reviveSession(session.id)
          terminalManager.restartTerminal(session.id, project.path)
        }
      }
    }
    prevActiveId.current = state.activeTerminalId
  }, [state.activeTerminalId, state.sessions, state.projects, reviveSession, terminalManager])

  if (!state.activeTerminalId) {
    return <IdleScreen />
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header for the active terminal */}
      {activeSession && activeProject && (
        <TerminalHeader
          session={activeSession}
          projectPath={activeProject.path}
          terminalManager={terminalManager}
        />
      )}

      {/* Search bar */}
      {searchOpen && state.activeTerminalId && (
        <SearchBar
          sessionId={state.activeTerminalId}
          terminalManager={terminalManager}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Terminal views — all rendered, only active is visible.
         This preserves xterm.js output when switching sessions. */}
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
              terminalManager={terminalManager}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
