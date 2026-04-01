/**
 * useTerminalManager — manages the xterm.js Terminal instances and their
 * connection to the PTY backend.
 *
 * Keeps a persistent map of Terminal instances (ref-based, survives re-renders).
 * Terminals are created once and never destroyed until explicitly removed,
 * ensuring output is preserved when switching between sessions.
 *
 * This hook is consumed by TerminalManagerProvider — components should use
 * useTerminalManager() from context/terminal-manager.tsx instead.
 */

import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTerminalContext } from '@/context/terminal-context'
import { useSettings } from '@/context/settings-context'
import { spawnPty, writePty, resizePty, killPty } from '@/lib/api'
import type { PtyHandle } from '@/lib/api'
import type { TerminalManager } from '@/types'

interface TerminalEntry {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
}

export function useTerminalManager(): TerminalManager {
  const terminalsRef = useRef(new Map<string, TerminalEntry>())
  const pendingAttachRef = useRef(new Map<string, HTMLElement>())

  // Terminal titles reported by the shell (e.g. "zsh", "vim", "node server.js").
  const [terminalTitles, setTerminalTitles] = useState<Record<string, string>>({})

  // Track the active PTY per session to ignore stale exit events after restart.
  const activePtyRef = useRef(new Map<string, PtyHandle>())

  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const { markSessionDead, notifyBell } = useTerminalContext()
  const markSessionDeadRef = useRef(markSessionDead)
  markSessionDeadRef.current = markSessionDead
  const notifyBellRef = useRef(notifyBell)
  notifyBellRef.current = notifyBell

  /** Connect a PTY's output and exit events to an xterm instance. */
  const wirePty = useCallback((pty: PtyHandle, terminal: Terminal, sessionId: string) => {
    activePtyRef.current.set(sessionId, pty)

    pty.onData((data) => {
      if (activePtyRef.current.get(sessionId) !== pty) return
      const bytes = new Uint8Array(data)
      terminal.write(bytes)
      if (bytes.includes(0x07)) {
        notifyBellRef.current(sessionId)
      }
    })

    pty.onExit(() => {
      if (activePtyRef.current.get(sessionId) !== pty) return
      activePtyRef.current.delete(sessionId)
      markSessionDeadRef.current(sessionId)
    })
  }, [])

  const createTerminal = useCallback(
    (sessionId: string, cwd: string) => {
      const terminal = new Terminal({
        cursorBlink: true,
        cursorInactiveStyle: 'block',
        fontSize: settingsRef.current.fontSize,
        fontFamily: '"SF Mono", Menlo, monospace',
        scrollback: settingsRef.current.scrollback,
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

      terminal.onTitleChange((title) => {
        setTerminalTitles((prev) =>
          prev[sessionId] === title ? prev : { ...prev, [sessionId]: title }
        )
      })

      // Spawn PTY (use default 80x24 until attached & fitted).
      const pty = spawnPty(sessionId, cwd, 80, 24)
      wirePty(pty, terminal, sessionId)

      // Fix for macOS WKWebView: backspace and delete get routed through IME
      // composition and arrive mangled. Intercept and write directly to PTY.
      terminal.attachCustomKeyEventHandler((event) => {
        if (event.type !== 'keydown') return true

        if (event.key === 'Backspace') {
          if (event.metaKey || event.ctrlKey) return true
          writePty(sessionId, event.altKey ? '\x1b\x7f' : '\x7f')
          return false
        }
        if (event.key === 'Delete') {
          writePty(sessionId, '\x1b[3~')
          return false
        }
        // Fix for macOS WKWebView: arrow keys trigger native viewport scrolling.
        // Prevent the default browser behavior but let xterm handle the key normally.
        if (event.key.startsWith('Arrow')) {
          event.preventDefault()
        }
        return true
      })

      terminal.onData((data) => writePty(sessionId, data))

      terminal.onResize((e) => {
        if (e.cols > 0 && e.rows > 0) {
          resizePty(sessionId, e.cols, e.rows)
        }
      })

      // If a TerminalView already requested attachment before we existed, fulfill it now.
      const pendingContainer = pendingAttachRef.current.get(sessionId)
      if (pendingContainer) {
        pendingAttachRef.current.delete(sessionId)
        terminal.open(pendingContainer)
        requestAnimationFrame(() => {
          if (pendingContainer.offsetWidth > 0 && pendingContainer.offsetHeight > 0) {
            fitAddon.fit()
          }
        })
      }
    },
    [wirePty]
  )

  const attachTerminal = useCallback((sessionId: string, container: HTMLElement) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) {
      pendingAttachRef.current.set(sessionId, container)
      return
    }

    const { terminal, fitAddon } = entry
    if (!terminal.element) {
      terminal.open(container)
    } else if (terminal.element.parentElement !== container) {
      // Re-parent the terminal to a different pane container.
      container.appendChild(terminal.element)
    }

    requestAnimationFrame(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit()
      }
    })
  }, [])

  const fitTerminal = useCallback((sessionId: string) => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry) return
    const el = entry.terminal.element
    if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return
    entry.fitAddon.fit()
  }, [])

  const focusTerminal = useCallback((sessionId: string) => {
    terminalsRef.current.get(sessionId)?.terminal.focus()
  }, [])

  const destroyTerminal = useCallback((sessionId: string) => {
    activePtyRef.current.delete(sessionId)
    pendingAttachRef.current.delete(sessionId)
    const entry = terminalsRef.current.get(sessionId)
    if (entry) {
      entry.terminal.dispose()
      terminalsRef.current.delete(sessionId)
    }
    setTerminalTitles((prev) => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
    killPty(sessionId)
  }, [])

  const restartTerminal = useCallback(
    (sessionId: string, cwd: string) => {
      const entry = terminalsRef.current.get(sessionId)
      if (!entry) {
        createTerminal(sessionId, cwd)
        return
      }

      activePtyRef.current.delete(sessionId)
      killPty(sessionId)
      entry.terminal.clear()

      const pty = spawnPty(sessionId, cwd, entry.terminal.cols, entry.terminal.rows)
      wirePty(pty, entry.terminal, sessionId)
    },
    [createTerminal, wirePty]
  )

  const searchTerminal = useCallback((sessionId: string, query: string): boolean => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry || !query) return false
    return entry.searchAddon.findNext(query, { caseSensitive: false })
  }, [])

  const searchTerminalPrevious = useCallback((sessionId: string, query: string): boolean => {
    const entry = terminalsRef.current.get(sessionId)
    if (!entry || !query) return false
    return entry.searchAddon.findPrevious(query, { caseSensitive: false })
  }, [])

  const clearSearch = useCallback((sessionId: string) => {
    terminalsRef.current.get(sessionId)?.searchAddon.clearDecorations()
  }, [])

  const clearTerminalScreen = useCallback((sessionId: string) => {
    terminalsRef.current.get(sessionId)?.terminal.clear()
  }, [])

  // Apply settings changes to all existing terminals.
  useEffect(() => {
    for (const [, entry] of terminalsRef.current) {
      entry.terminal.options.fontSize = settings.fontSize
      entry.terminal.options.scrollback = settings.scrollback
      entry.terminal.clearTextureAtlas()
      const el = entry.terminal.element
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        entry.fitAddon.fit()
      }
    }
    const timeout = setTimeout(() => {
      for (const [, entry] of terminalsRef.current) {
        const el = entry.terminal.element
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          entry.fitAddon.fit()
        }
      }
    }, 150)
    return () => clearTimeout(timeout)
  }, [settings.fontSize, settings.scrollback])

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
      clearTerminalScreen,
      terminalTitles
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
      clearTerminalScreen,
      terminalTitles
    ]
  )
}
