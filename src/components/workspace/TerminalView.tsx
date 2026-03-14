/**
 * TerminalView — wraps a single xterm.js terminal canvas.
 *
 * Attaches the terminal to the DOM on mount and handles resize events.
 * The xterm instance itself is managed by useTerminalManager (not local state),
 * so it persists across show/hide cycles.
 *
 * Right-click shows a custom context menu.
 */

import { useRef, useEffect, useState } from 'react'
import { useTerminalManager } from '@/hooks/use-terminal'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  sessionId: string
  isVisible: boolean
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function TerminalView({ sessionId, isVisible, terminalManager }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Use a ref for terminalManager so effects don't re-run when it changes.
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

  // Refit on window resize.
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        managerRef.current.fitTerminal(sessionId)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isVisible, sessionId])

  // Right-click context menu.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
    el.addEventListener('contextmenu', handleContextMenu)
    return () => el.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // Close context menu on any click.
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const handleClear = () => {
    managerRef.current.clearTerminalScreen(sessionId)
    setContextMenu(null)
  }

  return (
    <div ref={containerRef} className="h-full w-full relative bg-background pl-3 pt-2">
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[120px] rounded-md border border-border bg-card py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
            onClick={handleClear}
          >
            Clear Terminal
          </button>
        </div>
      )}
    </div>
  )
}
