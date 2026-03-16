/**
 * TerminalContext — centralized state for workspaces and terminal sessions.
 *
 * Uses React Context + useReducer for predictable state updates.
 * All terminal and workspace mutations go through dispatched actions.
 * Workspaces and sessions are persisted to disk via Tauri commands.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode
} from 'react'
import type { Workspace, TerminalSession } from '@/types'
import { getWorkspaces, saveWorkspaces, getSessions, saveSessions, pathExists } from '@/lib/api'
import { useSettings } from '@/context/settings-context'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'

// --- State shape ---

interface TerminalState {
  workspaces: Workspace[]
  sessions: TerminalSession[]
  activeTerminalId: string | null
  /** Session IDs with unread bell notifications. Not persisted. */
  bellSessionIds: Set<string>
}

const initialState: TerminalState = {
  workspaces: [],
  sessions: [],
  activeTerminalId: null,
  bellSessionIds: new Set()
}

// --- Actions ---

type Action =
  | { type: 'SET_WORKSPACES'; workspaces: Workspace[] }
  | { type: 'ADD_WORKSPACE'; workspace: Workspace }
  | { type: 'REMOVE_WORKSPACE'; workspaceId: string }
  | { type: 'REORDER_WORKSPACES'; fromIndex: number; toIndex: number }
  | { type: 'SET_SESSIONS'; sessions: TerminalSession[] }
  | { type: 'ADD_SESSION'; session: TerminalSession }
  | { type: 'REMOVE_SESSION'; sessionId: string }
  | { type: 'SET_ACTIVE_TERMINAL'; sessionId: string | null }
  | { type: 'SET_SESSION_RUNNING'; sessionId: string; isRunning: boolean }
  | { type: 'RENAME_SESSION'; sessionId: string; name: string }
  | { type: 'RENAME_WORKSPACE'; workspaceId: string; name: string }
  | { type: 'NOTIFY_BELL'; sessionId: string }
  | { type: 'CLEAR_BELL'; sessionId: string }

function reducer(state: TerminalState, action: Action): TerminalState {
  switch (action.type) {
    case 'SET_WORKSPACES':
      return { ...state, workspaces: action.workspaces }

    case 'ADD_WORKSPACE':
      return { ...state, workspaces: [...state.workspaces, action.workspace] }

    case 'REORDER_WORKSPACES': {
      const workspaces = [...state.workspaces]
      const [moved] = workspaces.splice(action.fromIndex, 1)
      workspaces.splice(action.toIndex, 0, moved)
      return { ...state, workspaces }
    }

    case 'REMOVE_WORKSPACE': {
      const remaining = state.sessions.filter((s) => s.workspaceId !== action.workspaceId)
      const removedIds = state.sessions
        .filter((s) => s.workspaceId === action.workspaceId)
        .map((s) => s.id)
      const lostActive = state.activeTerminalId && removedIds.includes(state.activeTerminalId)
      return {
        ...state,
        workspaces: state.workspaces.filter((w) => w.id !== action.workspaceId),
        sessions: remaining,
        activeTerminalId: lostActive ? (remaining[0]?.id ?? null) : state.activeTerminalId
      }
    }

    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }

    case 'ADD_SESSION':
      return {
        ...state,
        sessions: [...state.sessions, action.session],
        activeTerminalId: action.session.id
      }

    case 'REMOVE_SESSION': {
      const remaining = state.sessions.filter((s) => s.id !== action.sessionId)
      let nextActive = state.activeTerminalId
      if (state.activeTerminalId === action.sessionId) {
        // Switch to a sibling session, preferring the one before the removed one.
        const removedIndex = state.sessions.findIndex((s) => s.id === action.sessionId)
        const sibling = remaining[Math.min(removedIndex, remaining.length - 1)]
        nextActive = sibling?.id ?? null
      }
      return { ...state, sessions: remaining, activeTerminalId: nextActive }
    }

    case 'SET_ACTIVE_TERMINAL':
      return { ...state, activeTerminalId: action.sessionId }

    case 'SET_SESSION_RUNNING':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, isRunning: action.isRunning } : s
        )
      }

    case 'RENAME_SESSION':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId ? { ...s, name: action.name } : s
        )
      }

    case 'RENAME_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map((w) =>
          w.id === action.workspaceId ? { ...w, name: action.name } : w
        )
      }

    case 'NOTIFY_BELL': {
      if (state.activeTerminalId === action.sessionId) return state
      if (state.bellSessionIds.has(action.sessionId)) return state
      const next = new Set(state.bellSessionIds)
      next.add(action.sessionId)
      return { ...state, bellSessionIds: next }
    }

    case 'CLEAR_BELL': {
      if (!state.bellSessionIds.has(action.sessionId)) return state
      const next = new Set(state.bellSessionIds)
      next.delete(action.sessionId)
      return { ...state, bellSessionIds: next }
    }

    default:
      return state
  }
}

// --- Context ---

interface TerminalContextValue {
  state: TerminalState
  addWorkspace: (name: string, path: string) => void
  removeWorkspace: (workspaceId: string) => void
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void
  createSession: (workspaceId: string) => string
  removeSession: (sessionId: string) => void
  setActiveTerminal: (sessionId: string | null) => void
  markSessionDead: (sessionId: string) => void
  renameSession: (sessionId: string, name: string) => void
  renameWorkspace: (workspaceId: string, name: string) => void
  reviveSession: (sessionId: string) => void
  notifyBell: (sessionId: string) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

let sessionCounter = 0

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { settings } = useSettings()

  // Load persisted workspaces and sessions on mount.
  useEffect(() => {
    getWorkspaces().then(async (workspaces) => {
      if (workspaces.length === 0) {
        sessionsLoaded.current = true
        return
      }
      const checks = await Promise.all(
        workspaces.map(async (w) => ({
          workspace: w,
          exists: await pathExists(w.path)
        }))
      )
      const valid = checks.filter((c) => c.exists).map((c) => c.workspace)
      if (valid.length > 0) {
        dispatch({ type: 'SET_WORKSPACES', workspaces: valid })
      }
      if (valid.length !== workspaces.length) {
        saveWorkspaces(valid)
      }

      // Load saved sessions, filtering out any whose workspace no longer exists.
      const validIds = new Set(valid.map((w) => w.id))
      const savedSessions = await getSessions()
      const validSessions = savedSessions
        .filter((s) => validIds.has(s.workspaceId))
        .map((s) => ({ ...s, isRunning: false }))
      if (validSessions.length > 0) {
        dispatch({ type: 'SET_SESSIONS', sessions: validSessions })
        // Initialize session counter from the highest existing number to avoid name collisions.
        const maxNum = validSessions.reduce((max, s) => {
          const match = s.name.match(/^Terminal (\d+)$/)
          return match ? Math.max(max, parseInt(match[1], 10)) : max
        }, 0)
        sessionCounter = maxNum
      }
      if (validSessions.length !== savedSessions.length) {
        saveSessions(validSessions)
      }
      sessionsLoaded.current = true
    })
  }, [])

  // Persist workspaces whenever they change (skip the initial empty state).
  const isInitialWorkspaceMount = useRef(true)
  useEffect(() => {
    if (isInitialWorkspaceMount.current) {
      isInitialWorkspaceMount.current = false
      return
    }
    saveWorkspaces(state.workspaces)
  }, [state.workspaces])

  // Persist sessions whenever they change (skip until initial load completes).
  const sessionsLoaded = useRef(false)
  useEffect(() => {
    if (!sessionsLoaded.current) return
    saveSessions(state.sessions)
  }, [state.sessions])

  const addWorkspace = useCallback((name: string, path: string) => {
    const workspace: Workspace = { id: `workspace-${Date.now()}`, name, path }
    dispatch({ type: 'ADD_WORKSPACE', workspace })
  }, [])

  const removeWorkspace = useCallback((workspaceId: string) => {
    dispatch({ type: 'REMOVE_WORKSPACE', workspaceId })
  }, [])

  const reorderWorkspaces = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_WORKSPACES', fromIndex, toIndex })
  }, [])

  const createSession = useCallback((workspaceId: string): string => {
    sessionCounter++
    const session: TerminalSession = {
      id: `term-${Date.now()}-${sessionCounter}`,
      workspaceId,
      name: `Terminal ${sessionCounter}`,
      isRunning: true
    }
    dispatch({ type: 'ADD_SESSION', session })
    return session.id
  }, [])

  const removeSession = useCallback((sessionId: string) => {
    dispatch({ type: 'REMOVE_SESSION', sessionId })
  }, [])

  const setActiveTerminal = useCallback((sessionId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TERMINAL', sessionId })
    if (sessionId) {
      dispatch({ type: 'CLEAR_BELL', sessionId })
    }
  }, [])

  const markSessionDead = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SESSION_RUNNING', sessionId, isRunning: false })
  }, [])

  const renameSession = useCallback((sessionId: string, name: string) => {
    dispatch({ type: 'RENAME_SESSION', sessionId, name })
  }, [])

  const renameWorkspace = useCallback((workspaceId: string, name: string) => {
    dispatch({ type: 'RENAME_WORKSPACE', workspaceId, name })
  }, [])

  const reviveSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SESSION_RUNNING', sessionId, isRunning: true })
  }, [])

  const sessionsRef = useRef(state.sessions)
  sessionsRef.current = state.sessions

  const notifyBell = useCallback(
    async (sessionId: string) => {
      if (!settings.bellNotificationsEnabled) return
      dispatch({ type: 'NOTIFY_BELL', sessionId })

      let granted = await isPermissionGranted()
      if (!granted) {
        const permission = await requestPermission()
        granted = permission === 'granted'
      }
      if (granted) {
        const session = sessionsRef.current.find((s) => s.id === sessionId)
        sendNotification({
          title: 'shelldeck',
          body: `Bell in ${session?.name ?? 'terminal'}`
        })
      }
    },
    [settings.bellNotificationsEnabled]
  )

  return (
    <TerminalContext.Provider
      value={{
        state,
        addWorkspace,
        removeWorkspace,
        reorderWorkspaces,
        createSession,
        removeSession,
        setActiveTerminal,
        markSessionDead,
        renameSession,
        renameWorkspace,
        reviveSession,
        notifyBell
      }}
    >
      {children}
    </TerminalContext.Provider>
  )
}

/** Hook to access terminal context. Throws if used outside the provider. */
export function useTerminalContext(): TerminalContextValue {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error('useTerminalContext must be used within a TerminalProvider')
  }
  return context
}
