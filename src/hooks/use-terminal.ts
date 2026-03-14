/**
 * useTerminalManager — manages the xterm.js Terminal instances and their
 * connection to the PTY backend via the PTY backend.
 *
 * Keeps a persistent map of Terminal instances (ref-based, survives re-renders).
 * Terminals are created once and never destroyed until explicitly removed,
 * ensuring output is preserved when switching between sessions.
 */

import { useRef, useCallback, useMemo } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTerminalContext } from '@/context/terminal-context'
import { spawnPty, writePty, resizePty, killPty, removePtyEntry } from '@/lib/api'
import type { PtyHandle } from '@/lib/api'

interface TerminalEntry {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
}

export function useTerminalManager() {
  const terminalsRef = useRef(new Map<string, TerminalEntry>())
  const pendingAttachRef = useRef(new Map<string, HTMLElement>())

  // Track the active PTY per session to ignore stale exit events after restart.
  const activePtyRef = useRef(new Map<string, PtyHandle>())

  const { markSessionDead } = useTerminalContext()
  const markSessionDeadRef = useRef(markSessionDead)
  markSessionDeadRef.current = markSessionDead

  /** Connect a PTY's output and exit events to an xterm instance. */
  const wirePty = useCallback((pty: PtyHandle, terminal: Terminal, sessionId: string) => {
    activePtyRef.current.set(sessionId, pty)

    pty.onData((data) => {
      // Ignore data from a replaced PTY.
      if (activePtyRef.current.get(sessionId) !== pty) return
      terminal.write(new Uint8Array(data))
    })

    pty.onExit(() => {
      // Ignore exit from a stale PTY (already replaced by a restart).
      if (activePtyRef.current.get(sessionId) !== pty) return
      activePtyRef.current.delete(sessionId)
      removePtyEntry(sessionId)
      markSessionDeadRef.current(sessionId)
    })
  }, [])

  /**
   * Create a new xterm.js Terminal instance and spawn the backend PTY.
   * The terminal is not yet attached to a DOM element — call `attachTerminal` for that.
   */
  const createTerminal = useCallback(
    (sessionId: string, cwd: string) => {
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
        theme: {
          background: '#212121',
          foreground: '#e6e1da',
          cursor: '#e6e1da',
          selectionBackground: '#3a3a3a',
          black: '#212121',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#fafafa',
          brightBlack: '#52525b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff'
        },
        allowProposedApi: true
      })

      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(searchAddon)
      terminal.loadAddon(new WebLinksAddon())

      terminalsRef.current.set(sessionId, { terminal, fitAddon, searchAddon })

      // Spawn PTY via the PTY backend (use default 80x24 until attached & fitted).
      const pty = spawnPty(sessionId, cwd, 80, 24)
      wirePty(pty, terminal, sessionId)

      // Forward keystrokes from xterm to PTY.
      terminal.onData((data) => {
        writePty(sessionId, data)
      })

      // Sync resize from xterm to PTY.
      terminal.onResize((e) => {
        // Guard against 0-dimension resizes (e.g. fit() on a hidden terminal).
        if (e.cols > 0 && e.rows > 0) {
          resizePty(sessionId, e.cols, e.rows)
        }
      })

      // If a TerminalView already requested attachment before we existed, fulfill it now.
      const pendingContainer = pendingAttachRef.current.get(sessionId)
      if (pendingContainer) {
        pendingAttachRef.current.delete(sessionId)
        terminal.open(pendingContainer)
        // Fit only if the container is visible (hidden containers have 0 dimensions).
        requestAnimationFrame(() => {
          if (pendingContainer.offsetWidth > 0 && pendingContainer.offsetHeight > 0) {
            fitAddon.fit()
          }
        })
      }
    },
    [wirePty]
  )

  /**
   * Attach an xterm.js Terminal to a DOM container element.
   * Called once when the terminal view mounts.
   */
  const attachTerminal = useCallback((sessionId: string, container: HTMLElement) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) {
      // No xterm instance yet (restored session). Queue for when createTerminal runs.
      pendingAttachRef.current.set(sessionId, container)
      return
    }

    const { terminal, fitAddon } = entry

    // Only open if not already attached to a DOM element.
    if (!terminal.element) {
      terminal.open(container)
    }

    // Fit to container only if visible (hidden containers have 0 dimensions).
    requestAnimationFrame(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit()
      }
    })
  }, [])

  /** Refit a terminal to its container. Only safe to call when the terminal is visible. */
  const fitTerminal = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) return
    // Guard: don't fit if the terminal has no DOM element or the container is hidden.
    const el = entry.terminal.element
    if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return
    entry.fitAddon.fit()
  }, [])

  /** Focus the xterm terminal so it captures keystrokes. */
  const focusTerminal = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    entry?.terminal.focus()
  }, [])

  /** Dispose an xterm.js instance and kill the backend PTY. */
  const destroyTerminal = useCallback((sessionId: string) => {
    activePtyRef.current.delete(sessionId)
    pendingAttachRef.current.delete(sessionId)
    const entry = terminalsRef.current.get(sessionId)
    if (entry) {
      entry.terminal.dispose()
      terminalsRef.current.delete(sessionId)
    }
    killPty(sessionId)
  }, [])

  /** Restart: kill the old PTY, clear the terminal, and spawn a new PTY in the same cwd. */
  const restartTerminal = useCallback(
    (sessionId: string, cwd: string) => {
      const entry = terminalsRef.current.get(sessionId)
      if (!entry) {
        // Restored session with no xterm instance yet — create one from scratch.
        createTerminal(sessionId, cwd)
        return
      }

      // Mark old PTY as stale so its exit event is ignored.
      activePtyRef.current.delete(sessionId)
      killPty(sessionId)
      entry.terminal.clear()

      const pty = spawnPty(sessionId, cwd, entry.terminal.cols, entry.terminal.rows)
      wirePty(pty, entry.terminal, sessionId)
    },
    [createTerminal, wirePty]
  )

  /** Search forward in the terminal scrollback. Returns true if a match was found. */
  const searchTerminal = useCallback((sessionId: string, query: string): boolean => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry || !query) return false
    return entry.searchAddon.findNext(query, { caseSensitive: false })
  }, [])

  /** Search backward in the terminal scrollback. */
  const searchTerminalPrevious = useCallback((sessionId: string, query: string): boolean => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry || !query) return false
    return entry.searchAddon.findPrevious(query, { caseSensitive: false })
  }, [])

  /** Clear search highlights. */
  const clearSearch = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    entry?.searchAddon.clearDecorations()
  }, [])

  /** Clear the terminal screen (keeps the shell running). */
  const clearTerminalScreen = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    entry?.terminal.clear()
  }, [])

  // Memoize the returned object so consumers get a stable reference.
  // All callbacks are useCallback with stable deps, so this never recomputes.
  return useMemo(
    () => ({
      createTerminal,
      attachTerminal,
      fitTerminal,
      focusTerminal,
      destroyTerminal,
      restartTerminal,
      searchTerminal,
      searchTerminalPrevious,
      clearSearch,
      clearTerminalScreen
    }),
    [
      createTerminal,
      attachTerminal,
      fitTerminal,
      focusTerminal,
      destroyTerminal,
      restartTerminal,
      searchTerminal,
      searchTerminalPrevious,
      clearSearch,
      clearTerminalScreen
    ]
  )
}
