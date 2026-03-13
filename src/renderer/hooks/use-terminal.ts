/**
 * useTerminalManager — manages the xterm.js Terminal instances and their
 * connection to the PTY backend via the IPC bridge.
 *
 * Keeps a persistent map of Terminal instances (ref-based, survives re-renders).
 * Terminals are created once and never destroyed until explicitly removed,
 * ensuring output is preserved when switching between sessions.
 */

import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTerminalContext } from '../context/terminal-context'

interface TerminalEntry {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
}

export function useTerminalManager() {
  const terminalsRef = useRef(new Map<string, TerminalEntry>())
  const { markSessionDead } = useTerminalContext()

  // Listen for PTY data and exit events from the main process.
  useEffect(() => {
    const unsubData = window.shellDeck.onTerminalData(({ id, data }) => {
      const entry = terminalsRef.current.get(id)
      entry?.terminal.write(data)
    })

    const unsubExit = window.shellDeck.onTerminalExit(({ id }) => {
      markSessionDead(id)
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [markSessionDead])

  /**
   * Create a new xterm.js Terminal instance and spawn the backend PTY.
   * The terminal is not yet attached to a DOM element — call `attachTerminal` for that.
   */
  const createTerminal = useCallback((sessionId: string, cwd: string) => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        selectionBackground: '#27272a',
        black: '#09090b',
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

    // Forward keystrokes to the PTY backend.
    terminal.onData((data) => {
      window.shellDeck.writeTerminal(sessionId, data)
    })

    terminalsRef.current.set(sessionId, { terminal, fitAddon, searchAddon })

    // Spawn the backend PTY (use default 80x24 until attached & fitted).
    window.shellDeck.spawnTerminal(sessionId, cwd, 80, 24)
  }, [])

  /**
   * Attach an xterm.js Terminal to a DOM container element.
   * Called when the terminal view mounts or becomes visible.
   */
  const attachTerminal = useCallback((sessionId: string, container: HTMLElement) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) return

    const { terminal, fitAddon } = entry

    // Only open if not already attached to a DOM element.
    if (!terminal.element) {
      terminal.open(container)
    }

    // Fit to container and sync dimensions with the PTY backend.
    requestAnimationFrame(() => {
      fitAddon.fit()
      window.shellDeck.resizeTerminal(sessionId, terminal.cols, terminal.rows)
    })
  }, [])

  /** Refit a terminal after its container resizes. */
  const fitTerminal = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) return
    const { terminal, fitAddon } = entry
    fitAddon.fit()
    window.shellDeck.resizeTerminal(sessionId, terminal.cols, terminal.rows)
  }, [])

  /** Dispose an xterm.js instance and kill the backend PTY. */
  const destroyTerminal = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    if (entry) {
      entry.terminal.dispose()
      terminalsRef.current.delete(sessionId)
    }
    window.shellDeck.killTerminal(sessionId)
  }, [])

  /** Restart: kill the old PTY, clear the terminal, and spawn a new PTY in the same cwd. */
  const restartTerminal = useCallback((sessionId: string, cwd: string) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) return
    window.shellDeck.killTerminal(sessionId)
    entry.terminal.clear()
    window.shellDeck.spawnTerminal(sessionId, cwd, entry.terminal.cols, entry.terminal.rows)
  }, [])

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

  return {
    createTerminal,
    attachTerminal,
    fitTerminal,
    destroyTerminal,
    restartTerminal,
    searchTerminal,
    searchTerminalPrevious,
    clearSearch,
    clearTerminalScreen
  }
}
