/**
 * Shared data types used across the application.
 */

/** Represents a workspace (local folder) added to shelldeck. */
export interface Workspace {
  id: string
  name: string
  path: string
}

/** The state of a terminal as tracked by the renderer. */
export interface TerminalSession {
  id: string
  workspaceId: string | null
  name: string
  isRunning: boolean
}

/** Layout tree for split panes. */
export type PaneLayout =
  | { type: 'leaf'; sessionId: string }
  | { type: 'placeholder' }
  | {
      type: 'split'
      direction: 'horizontal' | 'vertical'
      ratio: number
      children: [PaneLayout, PaneLayout]
    }

/** Persistent app settings. */
export interface AppSettings {
  sidebarWidth: number
  bellNotificationsEnabled: boolean
  fontSize: number
  scrollback: number
  zoomLevel: number
}

/** Settings panel categories. */
export type SettingsCategory = 'terminal' | 'notifications'

/** Public interface for terminal xterm.js lifecycle management. */
export interface TerminalManager {
  createTerminal: (sessionId: string, cwd: string) => void
  attachTerminal: (sessionId: string, container: HTMLElement) => void
  fitTerminal: (sessionId: string) => void
  focusTerminal: (sessionId: string) => void
  destroyTerminal: (sessionId: string) => void
  restartTerminal: (sessionId: string, cwd: string) => void
  searchTerminal: (sessionId: string, query: string) => boolean
  searchTerminalPrevious: (sessionId: string, query: string) => boolean
  clearSearch: (sessionId: string) => void
  clearTerminalScreen: (sessionId: string) => void
  terminalTitles: Record<string, string>
}
