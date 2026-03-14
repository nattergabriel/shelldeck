/**
 * Shared data types used across the application.
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

/** System resource usage stats. */
export interface SystemStats {
  cpuUsage: number // percentage 0-100
  memoryUsage: number // percentage 0-100
  memoryUsedGB: number
  memoryTotalGB: number
}
