/**
 * Tauri API bridge — replaces the Electron preload `window.shellDeck` API.
 *
 * PTY operations use `tauri-pty` (direct JS calls).
 * Store, dialog, stats, and fs use Tauri `invoke()` commands.
 */

import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { spawn, type IPty } from 'tauri-pty'
import { platform } from '@tauri-apps/plugin-os'
import type { Project, TerminalSession, SystemStats } from '../../shared/types'

// --- PTY Management ---

const ptyInstances = new Map<string, IPty>()

function getShell(): string {
  return platform() === 'windows' ? 'powershell.exe' : '/bin/zsh'
}

export function spawnPty(
  id: string,
  cwd: string,
  cols: number,
  rows: number
): IPty {
  const pty = spawn(getShell(), [], {
    cols,
    rows,
    cwd,
    env: { TERM: 'xterm-256color' }
  })
  ptyInstances.set(id, pty)
  return pty
}

export function writePty(id: string, data: string): void {
  ptyInstances.get(id)?.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  ptyInstances.get(id)?.resize(cols, rows)
}

export function killPty(id: string): void {
  const pty = ptyInstances.get(id)
  if (pty) {
    pty.kill()
    ptyInstances.delete(id)
  }
}

export function killAllPtys(): void {
  for (const [id, pty] of ptyInstances) {
    pty.kill()
    ptyInstances.delete(id)
  }
}

export function getPtyInstance(id: string): IPty | undefined {
  return ptyInstances.get(id)
}

// --- Dialog ---

export async function openFolderDialog(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false })
  return result ?? null
}

// --- Store (JSON persistence via Tauri commands) ---

export async function getProjects(): Promise<Project[]> {
  return await invoke<Project[]>('get_projects')
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await invoke('save_projects', { projects })
}

export async function getSessions(): Promise<TerminalSession[]> {
  return await invoke<TerminalSession[]>('get_sessions')
}

export async function saveSessions(sessions: TerminalSession[]): Promise<void> {
  await invoke('save_sessions', { sessions })
}

export async function getSettings(): Promise<Record<string, unknown>> {
  return await invoke<Record<string, unknown>>('get_settings')
}

export async function saveSettings(settings: Record<string, unknown>): Promise<void> {
  await invoke('save_settings', { settings })
}

// --- Filesystem ---

export async function pathExists(path: string): Promise<boolean> {
  return await invoke<boolean>('path_exists', { path })
}

// --- System Stats ---

export async function getSystemStats(): Promise<SystemStats> {
  return await invoke<SystemStats>('get_system_stats')
}
