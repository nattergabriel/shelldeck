/**
 * TerminalView — wraps a single xterm.js terminal canvas.
 *
 * Attaches the terminal to the DOM on mount and handles resize events.
 * The xterm instance itself is managed by useTerminalManager (not local state),
 * so it persists across show/hide cycles.
 */

import { useRef, useEffect } from 'react'
import { useTerminalManager } from '@/hooks/use-terminal'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  sessionId: string
  isVisible: boolean
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function TerminalView({ sessionId, isVisible, terminalManager }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const attachedRef = useRef(false)

  // Attach the xterm terminal to this container on first render.
  useEffect(() => {
    if (!containerRef.current || attachedRef.current) return
    attachedRef.current = true
    terminalManager.attachTerminal(sessionId, containerRef.current)
  }, [sessionId, terminalManager])

  // Refit when this terminal becomes visible (container dimensions may have changed).
  useEffect(() => {
    if (isVisible) {
      // Small delay to let the DOM settle before measuring.
      const timeout = setTimeout(() => {
        terminalManager.fitTerminal(sessionId)
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [isVisible, sessionId, terminalManager])

  // Refit on window resize.
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        terminalManager.fitTerminal(sessionId)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isVisible, sessionId, terminalManager])

  // Right-click context menu.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      window.shellDeck.showTerminalContextMenu()
    }
    el.addEventListener('contextmenu', handleContextMenu)
    return () => el.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // Handle context menu actions from the main process.
  useEffect(() => {
    if (!isVisible) return
    const unsub = window.shellDeck.onContextMenuAction((action) => {
      if (action === 'clear') {
        terminalManager.clearTerminalScreen(sessionId)
      }
    })
    return unsub
  }, [isVisible, sessionId, terminalManager])

  return <div ref={containerRef} className="h-full w-full" />
}
