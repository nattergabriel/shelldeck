/**
 * Sidebar — left panel containing the workspace list and terminal navigation.
 * Acts as the primary navigation for switching between terminal sessions.
 * Width is controlled by the parent via props (for drag-resize support).
 * When settings is open, renders the settings category list instead.
 */

import { WorkspaceList } from './WorkspaceList'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { useTerminalContext } from '@/context/terminal-context'
import { Plus, Settings } from 'lucide-react'
import { openFolderDialog } from '@/lib/api'
import type { SettingsCategory } from '@/types'

interface SidebarProps {
  width: number
  settingsOpen: boolean
  settingsCategory: SettingsCategory
  onOpenSettings: () => void
  onCloseSettings: () => void
  onSelectSettingsCategory: (category: SettingsCategory) => void
}

export function Sidebar({
  width,
  settingsOpen,
  settingsCategory,
  onOpenSettings,
  onCloseSettings,
  onSelectSettingsCategory
}: SidebarProps) {
  const { state, addWorkspace } = useTerminalContext()

  const handleAddWorkspace = async () => {
    const folderPath = await openFolderDialog()
    if (!folderPath) return

    const name = folderPath.split('/').pop() || folderPath
    addWorkspace(name, folderPath)
  }

  return (
    <aside className="flex flex-col border-r border-border bg-card shrink-0" style={{ width }}>
      {/* Spacer for macOS traffic lights */}
      <div className="h-12 shrink-0" data-tauri-drag-region />

      {/* Logo + name */}
      <div className="flex items-center gap-2.5 px-4 pb-4">
        <svg viewBox="0 0 512 512" className="w-7 h-7 shrink-0" fill="none">
          <path
            d="M 144 148 L 296 256 L 144 364"
            stroke="#e6e1da"
            strokeWidth="56"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="328"
            y1="364"
            x2="400"
            y2="364"
            stroke="#34d399"
            strokeWidth="56"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-base font-semibold text-foreground tracking-tight">shelldeck</span>
      </div>

      {settingsOpen ? (
        <SettingsSidebar
          activeCategory={settingsCategory}
          onSelectCategory={onSelectSettingsCategory}
          onBack={onCloseSettings}
        />
      ) : (
        <>
          {/* Workspaces heading + add button */}
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspaces
            </span>
            <button
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={handleAddWorkspace}
              title="Add Workspace"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Workspace list with terminal sessions */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {state.workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center mt-12 px-4">
                No workspaces yet
              </p>
            ) : (
              <WorkspaceList />
            )}
          </div>

          {/* Settings button at bottom */}
          <div className="border-t border-border px-3 py-2">
            <button
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors w-full"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
