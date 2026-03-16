/**
 * TerminalManagerContext — provides the terminal xterm.js manager globally.
 *
 * Wraps the useTerminalManager hook in a context so components can access
 * terminal operations without prop drilling.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useTerminalManager as useTerminalManagerHook } from '@/hooks/use-terminal'
import type { TerminalManager } from '@/types'

const TerminalManagerContext = createContext<TerminalManager | null>(null)

export function TerminalManagerProvider({ children }: { children: ReactNode }) {
  const manager = useTerminalManagerHook()
  return (
    <TerminalManagerContext.Provider value={manager}>{children}</TerminalManagerContext.Provider>
  )
}

export function useTerminalManager(): TerminalManager {
  const context = useContext(TerminalManagerContext)
  if (!context) {
    throw new Error('useTerminalManager must be used within a TerminalManagerProvider')
  }
  return context
}
