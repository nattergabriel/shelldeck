/**
 * TerminalContext — centralized state for projects and terminal sessions.
 *
 * Uses React Context + useReducer for predictable state updates.
 * All terminal and project mutations go through dispatched actions.
 * Projects are persisted to disk via the main process store.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  ReactNode
} from 'react'
import { Project, TerminalSession } from '../../shared/types'

// --- State shape ---

interface TerminalState {
  projects: Project[]
  sessions: TerminalSession[]
  activeTerminalId: string | null
}

const initialState: TerminalState = {
  projects: [],
  sessions: [],
  activeTerminalId: null
}

// --- Actions ---

type Action =
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'REMOVE_PROJECT'; projectId: string }
  | { type: 'REORDER_PROJECTS'; fromIndex: number; toIndex: number }
  | { type: 'SET_SESSIONS'; sessions: TerminalSession[] }
  | { type: 'ADD_SESSION'; session: TerminalSession }
  | { type: 'REMOVE_SESSION'; sessionId: string }
  | { type: 'SET_ACTIVE_TERMINAL'; sessionId: string | null }
  | { type: 'SET_SESSION_RUNNING'; sessionId: string; isRunning: boolean }
  | { type: 'RENAME_SESSION'; sessionId: string; name: string }

function reducer(state: TerminalState, action: Action): TerminalState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.projects }

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }

    case 'REORDER_PROJECTS': {
      const projects = [...state.projects]
      const [moved] = projects.splice(action.fromIndex, 1)
      projects.splice(action.toIndex, 0, moved)
      return { ...state, projects }
    }

    case 'REMOVE_PROJECT': {
      const sessionIds = state.sessions
        .filter((s) => s.projectId === action.projectId)
        .map((s) => s.id)
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.projectId),
        sessions: state.sessions.filter((s) => s.projectId !== action.projectId),
        activeTerminalId:
          state.activeTerminalId && sessionIds.includes(state.activeTerminalId)
            ? null
            : state.activeTerminalId
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

    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.sessionId),
        activeTerminalId:
          state.activeTerminalId === action.sessionId ? null : state.activeTerminalId
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

    default:
      return state
  }
}

// --- Context ---

interface TerminalContextValue {
  state: TerminalState
  dispatch: React.Dispatch<Action>
  addProject: (name: string, path: string) => void
  removeProject: (projectId: string) => void
  reorderProjects: (fromIndex: number, toIndex: number) => void
  createSession: (projectId: string) => string
  removeSession: (sessionId: string) => void
  setActiveTerminal: (sessionId: string | null) => void
  markSessionDead: (sessionId: string) => void
  renameSession: (sessionId: string, name: string) => void
  /** Mark a restored (dead) session as running again. */
  reviveSession: (sessionId: string) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

let sessionCounter = 0

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const projectsRef = useRef(state.projects)
  projectsRef.current = state.projects

  // Load persisted projects and sessions on mount.
  useEffect(() => {
    window.shellDeck.getProjects().then(async (projects) => {
      if (projects.length === 0) {
        sessionsLoaded.current = true
        return
      }
      const checks = await Promise.all(
        projects.map(async (p) => ({
          project: p,
          exists: await window.shellDeck.pathExists(p.path)
        }))
      )
      const valid = checks.filter((c) => c.exists).map((c) => c.project)
      if (valid.length > 0) {
        dispatch({ type: 'SET_PROJECTS', projects: valid })
      }
      // Persist the cleaned list if any projects were removed.
      if (valid.length !== projects.length) {
        window.shellDeck.saveProjects(valid)
      }

      // Load saved sessions, filtering out any whose project no longer exists.
      const validIds = new Set(valid.map((p) => p.id))
      const savedSessions = await window.shellDeck.getSessions()
      const validSessions = savedSessions
        .filter((s) => validIds.has(s.projectId))
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
        window.shellDeck.saveSessions(validSessions)
      }
      sessionsLoaded.current = true
    })
  }, [])

  // Persist projects whenever they change (skip the initial empty state).
  const isInitialProjectMount = useRef(true)
  useEffect(() => {
    if (isInitialProjectMount.current) {
      isInitialProjectMount.current = false
      return
    }
    window.shellDeck.saveProjects(state.projects)
  }, [state.projects])

  // Persist sessions whenever they change (skip until initial load completes).
  const sessionsLoaded = useRef(false)
  useEffect(() => {
    if (!sessionsLoaded.current) return
    window.shellDeck.saveSessions(state.sessions)
  }, [state.sessions])

  const addProject = useCallback(
    (name: string, path: string) => {
      const project: Project = {
        id: `project-${Date.now()}`,
        name,
        path
      }
      dispatch({ type: 'ADD_PROJECT', project })
    },
    [dispatch]
  )

  const removeProject = useCallback(
    (projectId: string) => {
      dispatch({ type: 'REMOVE_PROJECT', projectId })
    },
    [dispatch]
  )

  const reorderProjects = useCallback(
    (fromIndex: number, toIndex: number) => {
      dispatch({ type: 'REORDER_PROJECTS', fromIndex, toIndex })
    },
    [dispatch]
  )

  /** Creates a new terminal session and returns its ID (so the caller can spawn the PTY). */
  const createSession = useCallback(
    (projectId: string): string => {
      sessionCounter++
      const session: TerminalSession = {
        id: `term-${Date.now()}-${sessionCounter}`,
        projectId,
        name: `Terminal ${sessionCounter}`,
        isRunning: true
      }
      dispatch({ type: 'ADD_SESSION', session })
      return session.id
    },
    [dispatch]
  )

  const removeSession = useCallback(
    (sessionId: string) => {
      dispatch({ type: 'REMOVE_SESSION', sessionId })
    },
    [dispatch]
  )

  const setActiveTerminal = useCallback(
    (sessionId: string | null) => {
      dispatch({ type: 'SET_ACTIVE_TERMINAL', sessionId })
    },
    [dispatch]
  )

  const markSessionDead = useCallback(
    (sessionId: string) => {
      dispatch({ type: 'SET_SESSION_RUNNING', sessionId, isRunning: false })
    },
    [dispatch]
  )

  const renameSession = useCallback(
    (sessionId: string, name: string) => {
      dispatch({ type: 'RENAME_SESSION', sessionId, name })
    },
    [dispatch]
  )

  const reviveSession = useCallback(
    (sessionId: string) => {
      dispatch({ type: 'SET_SESSION_RUNNING', sessionId, isRunning: true })
    },
    [dispatch]
  )

  return (
    <TerminalContext.Provider
      value={{
        state,
        dispatch,
        addProject,
        removeProject,
        reorderProjects,
        createSession,
        removeSession,
        setActiveTerminal,
        markSessionDead,
        renameSession,
        reviveSession
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
