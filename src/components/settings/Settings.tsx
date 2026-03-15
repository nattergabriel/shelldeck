/**
 * Settings — main settings content area.
 * Renders the active settings category panel.
 */

import { NotificationsSettings } from './NotificationsSettings'

export type SettingsCategory = 'notifications'

interface SettingsProps {
  category: SettingsCategory
}

export function Settings({ category }: SettingsProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
        {category === 'notifications' && <NotificationsSettings />}
      </div>
    </div>
  )
}
