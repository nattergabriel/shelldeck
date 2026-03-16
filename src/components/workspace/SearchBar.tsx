/**
 * SearchBar — inline search overlay for the active terminal.
 * Toggled via Cmd+F. Searches the terminal's scrollback buffer.
 */

import { useState, useRef, useEffect } from 'react'
import { useTerminalManager } from '@/context/terminal-manager'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

interface SearchBarProps {
  sessionId: string
  onClose: () => void
}

export function SearchBar({ sessionId, onClose }: SearchBarProps) {
  const terminalManager = useTerminalManager()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when the search bar opens.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear highlights when the search bar closes.
  useEffect(() => {
    return () => {
      terminalManager.clearSearch(sessionId)
    }
  }, [sessionId, terminalManager])

  const handleSearch = (direction: 'next' | 'prev') => {
    if (!query) return
    if (direction === 'next') {
      terminalManager.searchTerminal(sessionId, query)
    } else {
      terminalManager.searchTerminalPrevious(sessionId, query)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(e.shiftKey ? 'prev' : 'next')
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Live search on input change.
  useEffect(() => {
    if (query) {
      terminalManager.searchTerminal(sessionId, query)
    } else {
      terminalManager.clearSearch(sessionId)
    }
  }, [query, sessionId, terminalManager])

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
      <input
        ref={inputRef}
        type="text"
        className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-accent placeholder:text-muted-foreground"
        placeholder="Search terminal..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => handleSearch('prev')}
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => handleSearch('next')}
        title="Next match (Enter)"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onClose}
        title="Close (Escape)"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
