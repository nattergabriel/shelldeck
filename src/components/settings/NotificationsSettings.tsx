/**
 * NotificationsSettings — settings panel for notification preferences.
 */

import { useSettings } from '@/context/settings-context'
import { Switch } from '@/components/ui/switch'
import { Bell } from 'lucide-react'

export function NotificationsSettings() {
  const { settings, updateSetting } = useSettings()

  return (
    <div>
      <h2 className="text-lg font-medium text-foreground mb-6">Notifications</h2>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-card border border-border">
          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Bell notifications</p>
              <p className="text-sm text-muted-foreground mt-1">
                Show a system notification when a terminal emits a bell character (e.g. when a
                long-running command finishes).
              </p>
            </div>
          </div>
          <Switch
            checked={settings.bellNotificationsEnabled}
            onCheckedChange={(v) => updateSetting('bellNotificationsEnabled', v)}
          />
        </div>
      </div>
    </div>
  )
}
