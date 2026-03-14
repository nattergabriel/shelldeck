/**
 * Sidebar — left panel containing the project list and terminal navigation.
 * Acts as the primary navigation for switching between terminal sessions.
 * Width is controlled by the parent via props (for drag-resize support).
 */

import { ProjectList } from './ProjectList'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { Button } from '@/components/ui/button'
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

    // Use the folder name as the project name.
    const name = folderPath.split('/').pop() || folderPath
    addProject(name, folderPath)
  }

  return (
    <aside
      className="flex flex-col border-r border-border bg-zinc-900 shrink-0"
      style={{ width }}
    >
      {/* Spacer for macOS traffic lights */}
      <div className="h-12 border-b border-border/50" />

      {/* Add project button */}
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleAddProject}
        >
          <FolderPlus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      {/* Project list with terminal sessions */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {state.projects.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            No projects yet. Add a local folder to get started.
          </p>
        ) : (
          <ProjectList terminalManager={terminalManager} />
        )}
      </div>
    </aside>
  )
}
