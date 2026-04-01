/**
 * During drag, only the local visual ratio is updated (via onDrag) to avoid
 * dispatching to the global reducer on every pixel. The final ratio is
 * committed on mouseUp (via onCommit).
 */

import { useCallback, useRef } from 'react'

interface PaneResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  onDrag: (ratio: number) => void
  onCommit: (ratio: number) => void
}

export function PaneResizeHandle({ direction, onDrag, onCommit }: PaneResizeHandleProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const parent = containerRef.current?.parentElement
      if (!parent) return

      const rect = parent.getBoundingClientRect()
      let lastRatio = 0

      const onMouseMove = (ev: MouseEvent) => {
        let ratio: number
        if (direction === 'horizontal') {
          ratio = (ev.clientX - rect.left) / rect.width
        } else {
          ratio = (ev.clientY - rect.top) / rect.height
        }
        lastRatio = Math.max(0.15, Math.min(0.85, ratio))
        onDrag(lastRatio)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (lastRatio) onCommit(lastRatio)
      }

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [direction, onDrag, onCommit]
  )

  const handleDoubleClick = () => onCommit(0.5)

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={
        isHorizontal
          ? 'w-px cursor-col-resize hover:bg-accent transition-colors shrink-0 bg-border'
          : 'h-px cursor-row-resize hover:bg-accent transition-colors shrink-0 bg-border'
      }
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    />
  )
}
