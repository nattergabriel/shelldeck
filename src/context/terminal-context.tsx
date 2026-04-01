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
  useMemo,
  type ReactNode
} from 'react'
import type { Workspace, TerminalSession, PaneLayout } from '@/types'
import { getWorkspaces, saveWorkspaces, getSessions, saveSessions, pathExists } from '@/lib/api'
import {
  hasPane,
  hasPlaceholder,
  fillPlaceholder,
  splitPane,
  closePane,
  replacePane,
  getAllSessionIds
} from '@/lib/layout'
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
  /** The split-pane layout tree. null = no terminals visible (idle screen). */
  layout: PaneLayout | null
  /** Session IDs with unread bell notifications. Not persisted. */
  bellSessionIds: Set<string>
}

const initialState: TerminalState = {
  workspaces: [],
  sessions: [],
  activeTerminalId: null,
  layout: null,
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
  | { type: 'SET_LAYOUT'; layout: PaneLayout | null }
  | {
      type: 'SPLIT_PANE'
      direction: 'horizontal' | 'vertical'
    }
  | { type: 'CLOSE_PANE'; sessionId: string }

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
      // Remove all workspace sessions from layout.
      let nextLayout = state.layout
      for (const id of removedIds) {
        if (nextLayout && hasPane(nextLayout, id)) {
          nextLayout = closePane(nextLayout, id)
        }
      }
      return {
        ...state,
        workspaces: state.workspaces.filter((w) => w.id !== action.workspaceId),
        sessions: remaining,
        activeTerminalId: lostActive ? (remaining[0]?.id ?? null) : state.activeTerminalId,
        layout: nextLayout
      }
    }

    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }

    case 'ADD_SESSION': {
      const newLeaf: PaneLayout = { type: 'leaf', sessionId: action.session.id }
      let nextLayout: PaneLayout
      if (state.layout && hasPlaceholder(state.layout)) {
        // Fill the placeholder with the new session.
        nextLayout = fillPlaceholder(state.layout, action.session.id)
      } else if (
        state.layout &&
        state.activeTerminalId &&
        hasPane(state.layout, state.activeTerminalId)
      ) {
        // Replace the focused pane with the new session.
        nextLayout = replacePane(state.layout, state.activeTerminalId, action.session.id)
      } else {
        nextLayout = newLeaf
      }
      return {
        ...state,
        sessions: [...state.sessions, action.session],
        activeTerminalId: action.session.id,
        layout: nextLayout
      }
    }

    case 'REMOVE_SESSION': {
      const remaining = state.sessions.filter((s) => s.id !== action.sessionId)
      let nextActive = state.activeTerminalId
      let nextLayout = state.layout
      // Remove from layout if present.
      if (nextLayout && hasPane(nextLayout, action.sessionId)) {
        nextLayout = closePane(nextLayout, action.sessionId)
      }
      if (state.activeTerminalId === action.sessionId) {
        // Pick the next focus from remaining layout leaves, or fall back to sibling in list.
        const layoutIds = nextLayout ? getAllSessionIds(nextLayout) : []
        if (layoutIds.length > 0) {
          nextActive = layoutIds[0]
        } else {
          const removedIndex = state.sessions.findIndex((s) => s.id === action.sessionId)
          const sibling = remaining[Math.min(removedIndex, remaining.length - 1)]
          nextActive = sibling?.id ?? null
          // Show the fallback terminal in the layout.
          if (nextActive) {
            nextLayout = { type: 'leaf', sessionId: nextActive }
          }
        }
      }
      return { ...state, sessions: remaining, activeTerminalId: nextActive, layout: nextLayout }
    }

    case 'SET_ACTIVE_TERMINAL': {
      if (!action.sessionId) return { ...state, activeTerminalId: null, layout: null }
      // If the session is already in the layout, just focus it.
      if (state.layout && hasPane(state.layout, action.sessionId)) {
        return { ...state, activeTerminalId: action.sessionId }
      }
      // If there's a placeholder, fill it with this session.
      if (state.layout && hasPlaceholder(state.layout)) {
        const nextLayout = fillPlaceholder(state.layout, action.sessionId)
        return { ...state, activeTerminalId: action.sessionId, layout: nextLayout }
      }
      // Otherwise, swap it into the focused pane (or show solo).
      let nextLayout: PaneLayout = { type: 'leaf', sessionId: action.sessionId }
      if (state.layout && state.activeTerminalId && hasPane(state.layout, state.activeTerminalId)) {
        nextLayout = replacePane(state.layout, state.activeTerminalId, action.sessionId)
      }
      return { ...state, activeTerminalId: action.sessionId, layout: nextLayout }
    }

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

    case 'SET_LAYOUT':
      return { ...state, layout: action.layout }

    case 'SPLIT_PANE': {
      if (!state.layout || !state.activeTerminalId) return state
      const newLayout = splitPane(state.layout, state.activeTerminalId, action.direction)
      return { ...state, layout: newLayout }
    }

    case 'CLOSE_PANE': {
      if (!state.layout) return state
      const newLayout = closePane(state.layout, action.sessionId)
      let nextActive = state.activeTerminalId
      if (state.activeTerminalId === action.sessionId) {
        const remaining = newLayout ? getAllSessionIds(newLayout) : []
        nextActive = remaining[0] ?? null
      }
      return { ...state, layout: newLayout, activeTerminalId: nextActive }
    }

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

// --- Context ---

interface TerminalContextValue {
  state: TerminalState
  addWorkspace: (name: string, path: string) => void
  removeWorkspace: (workspaceId: string) => void
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void
  createSession: (workspaceId: string | null) => string
  removeSession: (sessionId: string) => void
  setActiveTerminal: (sessionId: string | null) => void
  markSessionDead: (sessionId: string) => void
  renameSession: (sessionId: string, name: string) => void
  renameWorkspace: (workspaceId: string, name: string) => void
  reviveSession: (sessionId: string) => void
  notifyBell: (sessionId: string) => void
  splitFocusedPane: (direction: 'horizontal' | 'vertical') => void
  closePane: (sessionId: string) => void
  setLayout: (layout: PaneLayout | null) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const sessionCounter = useRef(0)
  const { settings } = useSettings()

  // Load persisted workspaces and sessions on mount.
  useEffect(() => {
    getWorkspaces().then(async (workspaces) => {
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
      workspacesLoaded.current = true

      // Load saved sessions, filtering out any whose workspace no longer exists.
      const validIds = new Set(valid.map((w) => w.id))
      const savedSessions = await getSessions()
      const validSessions = savedSessions
        .filter((s) => s.workspaceId === null || validIds.has(s.workspaceId))
        .map((s) => ({ ...s, isRunning: false }))
      if (validSessions.length > 0) {
        dispatch({ type: 'SET_SESSIONS', sessions: validSessions })
        // Initialize session counter from the highest existing number to avoid name collisions.
        const maxNum = validSessions.reduce((max, s) => {
          const match = s.name.match(/^Terminal (\d+)$/)
          return match ? Math.max(max, parseInt(match[1], 10)) : max
        }, 0)
        sessionCounter.current = maxNum
      }
      if (validSessions.length !== savedSessions.length) {
        saveSessions(validSessions)
      }
      sessionsLoaded.current = true
    })
  }, [])

  // Persist workspaces whenever they change (skip until initial load completes).
  const workspacesLoaded = useRef(false)
  useEffect(() => {
    if (!workspacesLoaded.current) return
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

  const createSession = useCallback((workspaceId: string | null): string => {
    sessionCounter.current++
    const session: TerminalSession = {
      id: `term-${Date.now()}-${sessionCounter.current}`,
      workspaceId,
      name: `Terminal ${sessionCounter.current}`,
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

  const splitFocusedPane = useCallback((direction: 'horizontal' | 'vertical') => {
    dispatch({ type: 'SPLIT_PANE', direction })
  }, [])

  const closePaneAction = useCallback((sessionId: string) => {
    dispatch({ type: 'CLOSE_PANE', sessionId })
  }, [])

  const setLayout = useCallback((layout: PaneLayout | null) => {
    dispatch({ type: 'SET_LAYOUT', layout })
  }, [])

  const value = useMemo(
    () => ({
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
      notifyBell,
      splitFocusedPane,
      closePane: closePaneAction,
      setLayout
    }),
    [
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
      notifyBell,
      splitFocusedPane,
      closePaneAction,
      setLayout
    ]
  )

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
}

/** Hook to access terminal context. Throws if used outside the provider. */
export function useTerminalContext(): TerminalContextValue {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error('useTerminalContext must be used within a TerminalProvider')
  }
  return context
}
