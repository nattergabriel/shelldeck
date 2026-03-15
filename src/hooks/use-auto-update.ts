/**
 * useAutoUpdate — checks for app updates on launch and prompts the user.
 */

import { useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export function useAutoUpdate() {
  useEffect(() => {
    let cancelled = false

    async function checkForUpdate() {
      try {
        const update = await check()
        if (!update || cancelled) return

        console.log(`Update available: ${update.version}`)
        await update.downloadAndInstall()
        await relaunch()
      } catch (e) {
        console.error('Update check failed:', e)
      }
    }

    checkForUpdate()

    return () => {
      cancelled = true
    }
  }, [])
}
