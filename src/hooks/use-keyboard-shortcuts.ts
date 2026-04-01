/**
 * useKeyboardShortcuts — registers global keyboard shortcuts for terminal management.
 *
 * Shortcuts (Cmd on macOS, Ctrl on other platforms):
 *   Mod+T          — New terminal in active/first workspace (or quick terminal if none)
 *   Mod+Shift+T    — New quick terminal
 *   Mod+W          — Kill active terminal (closes pane if in split)
 *   Mod+D          — Split focused pane right
 *   Mod+Shift+D    — Split focused pane down
 *   Mod+Option+←/→/↑/↓ — Navigate between panes
 *   Mod+Shift+[    — Switch to previous terminal
 *   Mod+Shift+]    — Switch to next terminal
 *   Mod+1-9        — Switch to terminal by index
 */

import { useEffect } from 'react'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/context/terminal-manager'
import { findAdjacentPane } from '@/lib/layout'
import { getHomeDir } from '@/lib/api'

export function useKeyboardShortcuts() {
  const { state, createSession, removeSession, setActiveTerminal, splitFocusedPane } =
    useTerminalContext()
  const terminalManager = useTerminalManager()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (!mod) return

      // Cmd+Shift+T — new quick terminal.
      if (e.key === 't' && e.shiftKey) {
        e.preventDefault()
        getHomeDir().then((home) => {
          const sessionId = createSession(null)
          terminalManager.createTerminal(sessionId, home)
        })
        return
      }

      // Cmd+T — new terminal in the active session's workspace, or the first workspace.
      // Falls back to a quick terminal if no workspaces exist.
      if (e.key === 't' && !e.shiftKey) {
        e.preventDefault()
        const activeSession = state.sessions.find((s) => s.id === state.activeTerminalId)
        const workspace = activeSession?.workspaceId
          ? state.workspaces.find((w) => w.id === activeSession.workspaceId)
          : state.workspaces[0]
        if (workspace) {
          const sessionId = createSession(workspace.id)
          terminalManager.createTerminal(sessionId, workspace.path)
        } else {
          getHomeDir().then((home) => {
            const sessionId = createSession(null)
            terminalManager.createTerminal(sessionId, home)
          })
        }
        return
      }

      // Cmd+Shift+D — split focused pane down (check before Cmd+D).
      if (e.key.toLowerCase() === 'd' && e.shiftKey) {
        e.preventDefault()
        if (!state.activeTerminalId) return
        splitFocusedPane('vertical')
        return
      }

      // Cmd+D — split focused pane right.
      if (e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault()
        if (!state.activeTerminalId) return
        splitFocusedPane('horizontal')
        return
      }

      // Cmd+W — kill active terminal.
      if (e.key === 'w' && !e.shiftKey) {
        e.preventDefault()
        if (!state.activeTerminalId) return
        terminalManager.destroyTerminal(state.activeTerminalId)
        removeSession(state.activeTerminalId)
        return
      }

      // Cmd+Option+Arrow — navigate between panes.
      if (e.altKey && e.key.startsWith('Arrow') && state.layout && state.activeTerminalId) {
        e.preventDefault()
        const direction = e.key.replace('Arrow', '').toLowerCase() as
          | 'left'
          | 'right'
          | 'up'
          | 'down'
        const target = findAdjacentPane(state.layout, state.activeTerminalId, direction)
        if (target) setActiveTerminal(target)
        return
      }

      // Cmd+Shift+[ — previous terminal.
      if (e.key === '[' && e.shiftKey) {
        e.preventDefault()
        if (state.sessions.length === 0) return
        const idx = state.sessions.findIndex((s) => s.id === state.activeTerminalId)
        const prev = idx <= 0 ? state.sessions.length - 1 : idx - 1
        setActiveTerminal(state.sessions[prev].id)
        return
      }

      // Cmd+Shift+] — next terminal.
      if (e.key === ']' && e.shiftKey) {
        e.preventDefault()
        if (state.sessions.length === 0) return
        const idx = state.sessions.findIndex((s) => s.id === state.activeTerminalId)
        const next = idx >= state.sessions.length - 1 ? 0 : idx + 1
        setActiveTerminal(state.sessions[next].id)
        return
      }

      // Cmd+1-9 — switch to terminal by index.
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 9 && !e.shiftKey) {
        e.preventDefault()
        const session = state.sessions[num - 1]
        if (session) setActiveTerminal(session.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    state.sessions,
    state.activeTerminalId,
    state.workspaces,
    state.layout,
    createSession,
    removeSession,
    setActiveTerminal,
    splitFocusedPane,
    terminalManager
  ])
}
