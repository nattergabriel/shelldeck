/**
 * App — root layout component.
 * Two-panel layout: Sidebar | ResizeHandle | Workspace.
 * Sidebar width is persisted to settings.
 * When settings is open, the workspace is replaced by the settings panel.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ResizeHandle } from '@/components/sidebar/ResizeHandle'
import { Workspace } from '@/components/workspace/Workspace'
import { Settings } from '@/components/settings/Settings'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSettings } from '@/context/settings-context'
import { useAutoUpdate } from '@/hooks/use-auto-update'
import type { SettingsCategory } from '@/types'

const DEFAULT_SIDEBAR_WIDTH = 256

export function App() {
  const { settings, updateSetting } = useSettings()
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('terminal')

  useKeyboardShortcuts()
  useAutoUpdate()

  // Show the window after the first paint.
  useEffect(() => {
    getCurrentWindow().show().catch(console.error)
  }, [])

  // Sync sidebar width from settings on load.
  useEffect(() => {
    const saved = settings.sidebarWidth
    if (typeof saved === 'number' && saved >= 180 && saved <= 480) {
      setSidebarWidth(saved)
    }
  }, [settings.sidebarWidth])

  // Keep a ref so the resize-end callback always sees the latest width.
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth

  const handleResizeEnd = useCallback(() => {
    updateSetting('sidebarWidth', sidebarWidthRef.current)
  }, [updateSetting])

  return (
    <div className="h-screen flex">
      <Sidebar
        width={sidebarWidth}
        settingsOpen={settingsOpen}
        settingsCategory={settingsCategory}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
        onSelectSettingsCategory={setSettingsCategory}
      />
      <ResizeHandle
        sidebarWidth={sidebarWidth}
        onResize={setSidebarWidth}
        onResizeEnd={handleResizeEnd}
      />
      {settingsOpen && <Settings category={settingsCategory} />}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ display: settingsOpen ? 'none' : undefined }}
      >
        <Workspace />
      </div>
    </div>
  )
}
