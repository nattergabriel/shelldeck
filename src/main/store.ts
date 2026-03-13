/**
 * Store — persists project data to a JSON file in the user's app data directory.
 * Uses Electron's app.getPath('userData') so it works across platforms.
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { Project } from '../shared/types'

const STORE_FILE = join(app.getPath('userData'), 'projects.json')

export function loadProjects(): Project[] {
  try {
    if (!existsSync(STORE_FILE)) return []
    const raw = readFileSync(STORE_FILE, 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(STORE_FILE, JSON.stringify(projects, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save projects:', err)
  }
}
