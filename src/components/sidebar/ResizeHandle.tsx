/**
 * ResizeHandle — a draggable handle between the sidebar and workspace.
 * Drag to resize the sidebar width. Double-click to reset to default.
 */

import { useCallback, useRef } from 'react'

const DEFAULT_WIDTH = 256
const MIN_WIDTH = 180
const MAX_WIDTH = 480

interface ResizeHandleProps {
  sidebarWidth: number
  onResize: (width: number) => void
  onResizeEnd: () => void
}

export function ResizeHandle({ sidebarWidth, onResize, onResizeEnd }: ResizeHandleProps) {
  const dragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      const startX = e.clientX
      const startWidth = sidebarWidth

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
        onResize(newWidth)
      }

      const onMouseUp = () => {
        dragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        onResizeEnd()
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sidebarWidth, onResize, onResizeEnd]
  )

  const handleDoubleClick = () => {
    onResize(DEFAULT_WIDTH)
    onResizeEnd()
  }

  return (
    <div
      className="w-px cursor-col-resize hover:bg-accent transition-colors shrink-0 bg-border"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    />
  )
}
