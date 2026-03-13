/**
 * Sidebar — left panel containing the project list and terminal navigation.
 * Acts as the primary navigation for switching between terminal sessions.
 */

import { ProjectList } from './ProjectList'
import { useTerminalContext } from '@/context/terminal-context'
import { useTerminalManager } from '@/hooks/use-terminal'
import { Button } from '@/components/ui/button'
import { FolderPlus } from 'lucide-react'

interface SidebarProps {
  terminalManager: ReturnType<typeof useTerminalManager>
}

export function Sidebar({ terminalManager }: SidebarProps) {
  const { state, addProject } = useTerminalContext()

  const handleAddProject = async () => {
    const folderPath = await window.shellDeck.openFolderDialog()
    if (!folderPath) return

    // Use the folder name as the project name.
    const name = folderPath.split('/').pop() || folderPath
    addProject(name, folderPath)
  }

  return (
    <aside className="flex flex-col w-64 min-w-[256px] border-r border-border bg-background">
      {/* Draggable title bar region for macOS */}
      <div className="h-10 flex items-center px-4 border-b border-border draggable-region">
        <span className="text-sm font-semibold text-foreground pl-16">ShellDeck</span>
      </div>

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
