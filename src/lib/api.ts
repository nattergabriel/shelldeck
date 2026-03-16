/**
 * Tauri API bridge — centralizes all backend communication.
 *
 * PTY operations use Tauri invoke() to our custom PTY backend.
 * Store, dialog, stats, and fs use invoke() Tauri commands.
 */

import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { platform } from '@tauri-apps/plugin-os'
import type { Project, TerminalSession, AppSettings } from '@/types'

// --- PTY Management ---

export interface PtyHandle {
  pid: number
  onData: (cb: (data: number[]) => void) => void
  onExit: (cb: (info: { exitCode: number }) => void) => void
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
}

function getShell(): string {
  return platform() === 'windows' ? 'powershell.exe' : '/bin/zsh'
}

const ptyHandles = new Map<string, PtyHandle>()

export function spawnPty(id: string, cwd: string, cols: number, rows: number): PtyHandle {
  const handle: PtyHandle = {
    pid: -1,
    onData: () => {},
    onExit: () => {},
    write: () => {},
    resize: () => {},
    kill: () => {}
  }

  const ready = invoke<number>('pty_spawn', {
    file: getShell(),
    args: [],
    cols: Math.max(cols, 1),
    rows: Math.max(rows, 1),
    cwd,
    env: {}
  }).then((pid) => {
    handle.pid = pid
    return pid
  })

  // Set up the read loop and exit wait once spawn completes.
  let dataCallback: ((data: number[]) => void) | null = null
  let exitCallback: ((info: { exitCode: number }) => void) | null = null

  handle.onData = (cb) => {
    dataCallback = cb
  }
  handle.onExit = (cb) => {
    exitCallback = cb
  }
  handle.write = (data: string) => {
    ready.then((pid) =>
      invoke('pty_write', { pid, data }).catch((e) => console.error('Write error:', e))
    )
  }
  handle.resize = (cols: number, rows: number) => {
    ready.then((pid) =>
      invoke('pty_resize', { pid, cols, rows }).catch((e) => console.error('Resize error:', e))
    )
  }
  handle.kill = () => {
    ready.then((pid) => invoke('pty_kill', { pid }).catch((e) => console.error('Kill error:', e)))
  }

  // Start the read loop.
  ready.then(async (pid) => {
    try {
      for (;;) {
        const data = await invoke<number[]>('pty_read', { pid })
        dataCallback?.(data)
      }
    } catch (e) {
      if (typeof e === 'string' && e.includes('EOF')) {
        return
      }
      console.error('Read error:', e)
    }
  })

  // Wait for exit and clean up the Rust-side session.
  ready.then(async (pid) => {
    try {
      const exitCode = await invoke<number>('pty_exitstatus', { pid })
      exitCallback?.({ exitCode })
    } catch (e) {
      console.error('Exit status error:', e)
    }
    invoke('pty_cleanup', { pid }).catch(() => {})
  })

  ptyHandles.set(id, handle)
  return handle
}

export function writePty(id: string, data: string): void {
  ptyHandles.get(id)?.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  ptyHandles.get(id)?.resize(cols, rows)
}

export function killPty(id: string): void {
  const handle = ptyHandles.get(id)
  if (handle) {
    handle.kill()
    ptyHandles.delete(id)
  }
}

export function killAllPtys(): void {
  for (const [id, handle] of ptyHandles) {
    handle.kill()
    ptyHandles.delete(id)
  }
}

export function removePtyEntry(id: string): void {
  ptyHandles.delete(id)
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

export async function getSettings(): Promise<Partial<AppSettings>> {
  return await invoke<Partial<AppSettings>>('get_settings')
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke('save_settings', { settings })
}

// --- Filesystem ---

export async function pathExists(path: string): Promise<boolean> {
  return await invoke<boolean>('path_exists', { path })
}
