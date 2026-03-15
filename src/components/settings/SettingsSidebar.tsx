/**
 * SettingsSidebar — macOS-style settings category list.
 * Shown in the sidebar area when settings is open.
 */

import { useState, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { Bell, ArrowLeft } from 'lucide-react'
import type { SettingsCategory } from './Settings'
import { cn } from '@/lib/utils'

const categories: { id: SettingsCategory; label: string; icon: typeof Bell }[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell }
]

interface SettingsSidebarProps {
  activeCategory: SettingsCategory
  onSelectCategory: (category: SettingsCategory) => void
  onBack: () => void
}

export function SettingsSidebar({
  activeCategory,
  onSelectCategory,
  onBack
}: SettingsSidebarProps) {
  const [version, setVersion] = useState('')

  useEffect(() => {
    getVersion().then(setVersion)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        className="flex items-center gap-2 px-3 py-2 mx-2 mb-1 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="border-b border-border mx-3 mb-2" />

      <p className="px-4 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Settings
      </p>

      {/* Category list */}
      <nav className="flex-1 px-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
              activeCategory === cat.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            onClick={() => onSelectCategory(cat.id)}
          >
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </button>
        ))}
      </nav>

      {version && <p className="px-4 py-3 text-xs text-muted-foreground/60">v{version}</p>}
    </div>
  )
}
