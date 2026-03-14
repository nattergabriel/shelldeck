/**
 * Sidebar — left panel containing the project list and terminal navigation.
 * Acts as the primary navigation for switching between terminal sessions.
 * Width is controlled by the parent via props (for drag-resize support).
 */

import { ProjectList } from './ProjectList'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { FolderPlus } from 'lucide-react'
import { openFolderDialog } from '@/lib/api'

interface SidebarProps {
  width: number
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function Sidebar({ width, terminalManager }: SidebarProps) {
  const { state, addProject } = useTerminalContext()

  const handleAddProject = async () => {
    const folderPath = await openFolderDialog()
    if (!folderPath) return

    const name = folderPath.split('/').pop() || folderPath
    addProject(name, folderPath)
  }

  return (
    <aside className="flex flex-col border-r border-border bg-card shrink-0" style={{ width }}>
      {/* Spacer for macOS traffic lights */}
      <div className="h-12 shrink-0" data-tauri-drag-region />

      {/* Add project button */}
      <div className="px-3 pb-3">
        <button
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground rounded-md border border-border hover:bg-accent hover:text-foreground transition-colors"
          onClick={handleAddProject}
        >
          <FolderPlus className="h-4 w-4" />
          Add Project
        </button>
      </div>

      <div className="border-b border-border mx-3 mb-2" />

      {/* Project list with terminal sessions */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {state.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-12 px-4">No projects yet</p>
        ) : (
          <ProjectList terminalManager={terminalManager} />
        )}
      </div>
    </aside>
  )
}
