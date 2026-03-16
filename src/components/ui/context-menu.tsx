/**
 * ContextMenu — reusable right-click context menu.
 * Auto-closes on any window click. Used by ProjectList and TerminalView.
 */

import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [onClose])

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-card py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  )
}

interface ContextMenuItemProps {
  onClick: () => void
  children: ReactNode
  destructive?: boolean
}

export function ContextMenuItem({ onClick, children, destructive }: ContextMenuItemProps) {
  return (
    <button
      className={cn(
        'w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent',
        destructive && 'hover:text-destructive'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function ContextMenuSeparator() {
  return <div className="border-t border-border my-1" />
}
