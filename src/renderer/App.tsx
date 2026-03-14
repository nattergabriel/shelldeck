/**
 * App — root layout component.
 * Three-panel layout: Sidebar | ResizeHandle | Workspace | StatusBar (bottom).
 * Sidebar width is persisted to settings.
 */

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ResizeHandle } from '@/components/sidebar/ResizeHandle'
import { Workspace } from '@/components/workspace/Workspace'
import { StatusBar } from '@/components/statusbar/StatusBar'
import { useTerminalManager } from '@/hooks/use-terminal'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { getSettings, saveSettings } from '@/lib/api'

const DEFAULT_SIDEBAR_WIDTH = 256

export function App() {
  const terminalManager = useTerminalManager()
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)

  useKeyboardShortcuts(terminalManager)

  // Load persisted sidebar width on mount.
  useEffect(() => {
    getSettings().then((s) => {
      const saved = s?.sidebarWidth
      if (typeof saved === 'number' && saved >= 180 && saved <= 480) {
        setSidebarWidth(saved)
      }
    })
  }, [])

  // Persist sidebar width when the user finishes dragging.
  const handleResizeEnd = useCallback(() => {
    saveSettings({ sidebarWidth })
  }, [sidebarWidth])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar width={sidebarWidth} terminalManager={terminalManager} />
        <ResizeHandle
          sidebarWidth={sidebarWidth}
          onResize={setSidebarWidth}
          onResizeEnd={handleResizeEnd}
        />
        <Workspace terminalManager={terminalManager} />
      </div>
      <StatusBar />
    </div>
  )
}
