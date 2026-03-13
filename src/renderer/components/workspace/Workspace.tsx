/**
 * Workspace — main content area displaying the active terminal session.
 *
 * All terminal containers are rendered simultaneously but only the active
 * one is visible (display: block vs. none). This keeps xterm.js instances
 * alive so no output is lost when switching sessions.
 */

import { useState, useEffect } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { TerminalHeader } from './TerminalHeader'
import { TerminalView } from './TerminalView'
import { SearchBar } from './SearchBar'

interface WorkspaceProps {
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function Workspace({ terminalManager }: WorkspaceProps) {
  const { state } = useTerminalContext()
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

  if (state.sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Add a project and open a terminal to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
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

      {/* Terminal views — all rendered, only active is visible */}
      <div className="flex-1 relative">
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
