/**
 * SplitPaneContainer — recursively renders a PaneLayout tree.
 *
 * Split nodes render as flex containers with a draggable resize handle.
 * Leaf nodes render a TerminalHeader + TerminalView for the session.
 * Placeholder nodes render a prompt to select a terminal.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { PaneLayout } from '@/types'
import { updateRatio, closePlaceholder } from '@/lib/layout'
import { useTerminalContext } from '@/context/terminal-context'
import { TerminalHeader } from './TerminalHeader'
import { TerminalView } from './TerminalView'
import { SearchBar } from './SearchBar'
import { PaneResizeHandle } from './PaneResizeHandle'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface SplitPaneContainerProps {
  layout: PaneLayout
  path: number[]
  searchOpen: boolean
  onCloseSearch: () => void
}

export function SplitPaneContainer({
  layout,
  path,
  searchOpen,
  onCloseSearch
}: SplitPaneContainerProps) {
  const { state, setActiveTerminal, setLayout } = useTerminalContext()

  if (layout.type === 'placeholder') {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-clip">
        <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-card shrink-0">
          <span className="text-sm font-medium text-muted-foreground pointer-events-none">
            New Pane
          </span>
          <button
            className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => {
              if (!state.layout) return
              setLayout(closePlaceholder(state.layout))
            }}
            title="Close Pane"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Select a terminal from the sidebar</p>
        </div>
      </div>
    )
  }

  if (layout.type === 'leaf') {
    const session = state.sessions.find((s) => s.id === layout.sessionId)
    const isFocused = state.activeTerminalId === layout.sessionId
    const isMultiPane = state.layout?.type === 'split'

    return (
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 min-h-0 overflow-clip',
          isMultiPane && isFocused && 'ring-1 ring-accent ring-inset'
        )}
        onMouseDown={() => {
          if (!isFocused) setActiveTerminal(layout.sessionId)
        }}
      >
        {session && <TerminalHeader session={session} showClosePane={isMultiPane} />}

        {isFocused && searchOpen && (
          <SearchBar sessionId={layout.sessionId} onClose={onCloseSearch} />
        )}

        <div className="flex-1 relative overflow-clip">
          <div className="absolute inset-0">
            <TerminalView sessionId={layout.sessionId} isVisible isFocused={isFocused} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <SplitNode layout={layout} path={path} searchOpen={searchOpen} onCloseSearch={onCloseSearch} />
  )
}

/**
 * SplitNode — renders a split layout node with local ratio state for smooth
 * dragging. Only commits the final ratio to the global layout on mouseUp.
 */
function SplitNode({
  layout,
  path,
  searchOpen,
  onCloseSearch
}: {
  layout: Extract<PaneLayout, { type: 'split' }>
  path: number[]
  searchOpen: boolean
  onCloseSearch: () => void
}) {
  const { state, setLayout } = useTerminalContext()
  const [localRatio, setLocalRatio] = useState(layout.ratio)

  // Use a ref so the mouseUp commit always sees the latest layout,
  // even if the tree changed during the drag.
  const stateLayoutRef = useRef(state.layout)
  stateLayoutRef.current = state.layout

  // Sync from global state (e.g. after double-click reset).
  useEffect(() => {
    setLocalRatio(layout.ratio)
  }, [layout.ratio])

  const handleCommit = useCallback(
    (ratio: number) => {
      setLocalRatio(ratio)
      if (!stateLayoutRef.current) return
      setLayout(updateRatio(stateLayoutRef.current, path, ratio))
    },
    [path, setLayout]
  )

  const isHorizontal = layout.direction === 'horizontal'

  return (
    <div className={cn('flex flex-1 min-w-0 min-h-0', isHorizontal ? 'flex-row' : 'flex-col')}>
      <div className="flex min-w-0 min-h-0 overflow-clip" style={{ flex: localRatio }}>
        <SplitPaneContainer
          layout={layout.children[0]}
          path={[...path, 0]}
          searchOpen={searchOpen}
          onCloseSearch={onCloseSearch}
        />
      </div>
      <PaneResizeHandle
        direction={layout.direction}
        onDrag={setLocalRatio}
        onCommit={handleCommit}
      />
      <div className="flex min-w-0 min-h-0 overflow-clip" style={{ flex: 1 - localRatio }}>
        <SplitPaneContainer
          layout={layout.children[1]}
          path={[...path, 1]}
          searchOpen={searchOpen}
          onCloseSearch={onCloseSearch}
        />
      </div>
    </div>
  )
}
