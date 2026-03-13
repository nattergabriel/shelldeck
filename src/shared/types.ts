/**
 * Types shared between the main and renderer processes.
 * These define the IPC contract and common data structures.
 */

/** Represents a project (local folder) added to shelldeck. */
export interface Project {
  id: string
  name: string
  path: string
}

/** The state of a terminal as tracked by the renderer. */
export interface TerminalSession {
  id: string
  projectId: string
  name: string
  isRunning: boolean
}

/** System resource usage stats pushed from the main process. */
export interface SystemStats {
  cpuUsage: number // percentage 0-100
  memoryUsage: number // percentage 0-100
  memoryUsedGB: number
  memoryTotalGB: number
}

/**
 * IPC channel names — single source of truth.
 * All IPC communication goes through these channels.
 */
export const IPC = {
  PTY_SPAWN: 'pty:spawn',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_KILL_ALL: 'pty:kill-all',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  SYSTEM_STATS: 'system:stats',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',
  STORE_GET_PROJECTS: 'store:get-projects',
  STORE_SAVE_PROJECTS: 'store:save-projects',
  STORE_GET_SETTINGS: 'store:get-settings',
  STORE_SAVE_SETTINGS: 'store:save-settings',
  FS_PATH_EXISTS: 'fs:path-exists',
  CONTEXT_MENU_TERMINAL: 'context-menu:terminal',
  CONTEXT_MENU_ACTION: 'context-menu:action'
} as const
