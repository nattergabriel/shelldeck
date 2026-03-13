/**
 * Preload script — exposes a typed, minimal API surface to the renderer
 * via contextBridge. The renderer NEVER accesses Node.js or Electron directly.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

export type ShellDeckAPI = typeof api

const api = {
  /** Spawn a new PTY with the given cwd. */
  spawnTerminal: (id: string, cwd: string, cols: number, rows: number) => {
    ipcRenderer.send(IPC.PTY_SPAWN, { id, cwd, cols, rows })
  },

  /** Send keystrokes to a PTY. */
  writeTerminal: (id: string, data: string) => {
    ipcRenderer.send(IPC.PTY_WRITE, { id, data })
  },

  /** Resize a PTY. */
  resizeTerminal: (id: string, cols: number, rows: number) => {
    ipcRenderer.send(IPC.PTY_RESIZE, { id, cols, rows })
  },

  /** Kill a single PTY. */
  killTerminal: (id: string) => {
    ipcRenderer.send(IPC.PTY_KILL, { id })
  },

  /** Emergency kill all PTYs. */
  killAllTerminals: () => {
    ipcRenderer.send(IPC.PTY_KILL_ALL)
  },

  /** Open a native folder picker. Returns the path or null. */
  openFolderDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER)
  },

  /** Load persisted projects from disk. */
  getProjects: (): Promise<Array<{ id: string; name: string; path: string }>> => {
    return ipcRenderer.invoke(IPC.STORE_GET_PROJECTS)
  },

  /** Save projects to disk. */
  saveProjects: (projects: Array<{ id: string; name: string; path: string }>) => {
    ipcRenderer.send(IPC.STORE_SAVE_PROJECTS, { projects })
  },

  /** Load persisted terminal sessions from disk. */
  getSessions: (): Promise<Array<{ id: string; projectId: string; name: string; isRunning: boolean }>> => {
    return ipcRenderer.invoke(IPC.STORE_GET_SESSIONS)
  },

  /** Save terminal sessions to disk. */
  saveSessions: (
    sessions: Array<{ id: string; projectId: string; name: string; isRunning: boolean }>
  ) => {
    ipcRenderer.send(IPC.STORE_SAVE_SESSIONS, { sessions })
  },

  /** Check if a filesystem path exists. */
  pathExists: (path: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC.FS_PATH_EXISTS, { path })
  },

  /** Load persisted settings (sidebar width, etc.). */
  getSettings: (): Promise<Record<string, unknown>> => {
    return ipcRenderer.invoke(IPC.STORE_GET_SETTINGS)
  },

  /** Save a partial settings update. */
  saveSettings: (settings: Record<string, unknown>) => {
    ipcRenderer.send(IPC.STORE_SAVE_SETTINGS, settings)
  },

  /** Show the native terminal context menu. */
  showTerminalContextMenu: () => {
    ipcRenderer.send(IPC.CONTEXT_MENU_TERMINAL)
  },

  /** Listen for context menu actions (e.g. "clear"). */
  onContextMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => {
      callback(action)
    }
    ipcRenderer.on(IPC.CONTEXT_MENU_ACTION, listener)
    return () => ipcRenderer.removeListener(IPC.CONTEXT_MENU_ACTION, listener)
  },

  // --- Event listeners (main → renderer) ---

  /** Listen for PTY data output. */
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.PTY_DATA, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
  },

  /** Listen for PTY exit events. */
  onTerminalExit: (callback: (data: { id: string; exitCode: number }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { id: string; exitCode: number }
    ) => {
      callback(payload)
    }
    ipcRenderer.on(IPC.PTY_EXIT, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, listener)
  },

  /** Listen for system stats updates. */
  onSystemStats: (
    callback: (stats: {
      cpuUsage: number
      memoryUsage: number
      memoryUsedGB: number
      memoryTotalGB: number
    }) => void
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, stats: Parameters<typeof callback>[0]) => {
      callback(stats)
    }
    ipcRenderer.on(IPC.SYSTEM_STATS, listener)
    return () => ipcRenderer.removeListener(IPC.SYSTEM_STATS, listener)
  }
}

contextBridge.exposeInMainWorld('shellDeck', api)
