/**
 * Store — persists app data to JSON files in the user's app data directory.
 * Uses Electron's app.getPath('userData') so it works across platforms.
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { Project, TerminalSession } from '../shared/types'

const DATA_DIR = join(app.getPath('userData'))
const PROJECTS_FILE = join(DATA_DIR, 'projects.json')
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJson(path: string, data: unknown): void {
  try {
    ensureDir()
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Failed to write ${path}:`, err)
  }
}

// --- Projects ---

export function loadProjects(): Project[] {
  const data = readJson<unknown>(PROJECTS_FILE, [])
  return Array.isArray(data) ? data : []
}

export function saveProjects(projects: Project[]): void {
  writeJson(PROJECTS_FILE, projects)
}

// --- Sessions ---

export function loadSessions(): TerminalSession[] {
  const data = readJson<unknown>(SESSIONS_FILE, [])
  return Array.isArray(data) ? data : []
}

export function saveSessions(sessions: TerminalSession[]): void {
  writeJson(SESSIONS_FILE, sessions)
}

// --- Settings (window state, sidebar width, etc.) ---

export interface AppSettings {
  windowBounds?: { x: number; y: number; width: number; height: number }
  windowIsMaximized?: boolean
  sidebarWidth?: number
}

export function loadSettings(): AppSettings {
  return readJson<AppSettings>(SETTINGS_FILE, {})
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_FILE, settings)
}
