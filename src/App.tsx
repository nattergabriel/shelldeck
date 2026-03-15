/**
 * App — root layout component.
 * Three-panel layout: Sidebar | ResizeHandle | Workspace | StatusBar (bottom).
 * Sidebar width is persisted to settings.
 * When settings is open, the workspace is replaced by the settings panel.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ResizeHandle } from '@/components/sidebar/ResizeHandle'
import { Workspace } from '@/components/workspace/Workspace'
import { Settings, type SettingsCategory } from '@/components/settings/Settings'
import { StatusBar } from '@/components/statusbar/StatusBar'
import { useTerminalManager } from '@/hooks/use-terminal'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSettings } from '@/context/settings-context'
import { useAutoUpdate } from '@/hooks/use-auto-update'
import { saveSettings } from '@/lib/api'

const DEFAULT_SIDEBAR_WIDTH = 256

export function App() {
  const terminalManager = useTerminalManager()
  const { settings } = useSettings()
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('notifications')

  useKeyboardShortcuts(terminalManager)
  useAutoUpdate()

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
    saveSettings({ ...settings, sidebarWidth: sidebarWidthRef.current } as unknown as Record<
      string,
      unknown
    >)
  }, [settings])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          width={sidebarWidth}
          terminalManager={terminalManager}
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
          <Workspace terminalManager={terminalManager} />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
