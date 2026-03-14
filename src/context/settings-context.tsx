/**
 * SettingsContext — centralized state for persistent app settings.
 *
 * Settings are loaded from disk on mount and auto-saved on change.
 * Uses the existing getSettings/saveSettings Tauri commands.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode
} from 'react'
import { getSettings, saveSettings } from '@/lib/api'

export interface AppSettings {
  sidebarWidth: number
  bellNotificationsEnabled: boolean
}

const defaultSettings: AppSettings = {
  sidebarWidth: 256,
  bellNotificationsEnabled: true
}

interface SettingsContextValue {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const loaded = useRef(false)

  // Load settings from disk on mount.
  useEffect(() => {
    getSettings().then((raw) => {
      setSettings((prev) => ({
        ...prev,
        ...raw
      }))
      loaded.current = true
    })
  }, [])

  // Auto-save when settings change (skip until initial load completes).
  useEffect(() => {
    if (!loaded.current) return
    saveSettings(settings as unknown as Record<string, unknown>)
  }, [settings])

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
