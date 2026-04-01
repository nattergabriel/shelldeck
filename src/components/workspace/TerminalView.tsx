/**
 * TerminalView — wraps a single xterm.js terminal canvas.
 *
 * Attaches the terminal to the DOM on mount and handles resize events.
 * The xterm instance itself is managed by TerminalManagerContext (not local state),
 * so it persists across show/hide cycles.
 *
 * Right-click shows a custom context menu.
 */

import { useRef, useEffect, useState } from 'react'
import { useTerminalManager } from '@/context/terminal-manager'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  sessionId: string
  isVisible: boolean
}

export function TerminalView({ sessionId, isVisible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalManager = useTerminalManager()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

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

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-clip bg-background pl-3 pt-2"
    >
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <ContextMenuItem
            onClick={() => {
              managerRef.current.clearTerminalScreen(sessionId)
              setContextMenu(null)
            }}
          >
            Clear Terminal
          </ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  )
}
