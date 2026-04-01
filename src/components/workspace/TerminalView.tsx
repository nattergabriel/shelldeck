/**
 * TerminalView — wraps a single xterm.js terminal canvas.
 *
 * Attaches the terminal to the DOM on mount and handles resize events.
 * The xterm instance itself is managed by TerminalManagerContext (not local state),
 * so it persists across show/hide cycles.
 *
 * Right-click shows a custom context menu.
 */

import { useRef, useEffect } from 'react'
import { useTerminalManager } from '@/context/terminal-manager'
import { Menu } from '@tauri-apps/api/menu'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  sessionId: string
  isVisible: boolean
  isFocused?: boolean
}

export function TerminalView({ sessionId, isVisible, isFocused }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalManager = useTerminalManager()

  // Use a ref so effects don't re-run when the manager reference changes.
  const managerRef = useRef(terminalManager)
  managerRef.current = terminalManager

  // Attach the xterm terminal to this container on mount (once).
  useEffect(() => {
    if (!containerRef.current) return
    managerRef.current.attachTerminal(sessionId, containerRef.current)
  }, [sessionId])

  // Refit and focus when this terminal becomes visible.
  useEffect(() => {
    if (!isVisible) return
    const timeout = setTimeout(() => {
      managerRef.current.fitTerminal(sessionId)
      managerRef.current.focusTerminal(sessionId)
    }, 50)
    return () => clearTimeout(timeout)
  }, [isVisible, sessionId])

  // Focus xterm when this pane becomes the focused pane in a split layout.
  useEffect(() => {
    if (!isFocused) return
    managerRef.current.focusTerminal(sessionId)
  }, [isFocused, sessionId])

  // Refit when the container size changes (window resize, sidebar drag, etc.).
  useEffect(() => {
    const el = containerRef.current
    if (!el || !isVisible) return
    const observer = new ResizeObserver(() => {
      managerRef.current.fitTerminal(sessionId)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isVisible, sessionId])

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-clip bg-background pl-3 pt-2"
      onContextMenu={async (e) => {
        e.preventDefault()
        const menu = await Menu.new({
          items: [
            {
              text: 'Clear Terminal',
              action: () => managerRef.current.clearTerminalScreen(sessionId)
            }
          ]
        })
        await menu.popup()
      }}
    ></div>
  )
}
