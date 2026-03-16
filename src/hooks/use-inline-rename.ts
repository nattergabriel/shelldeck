/**
 * useInlineRename — reusable hook for inline rename behavior.
 * Used by ProjectList (rename projects) and TerminalList (rename sessions).
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent
} from 'react'

export function useInlineRename(onCommit: (id: string, name: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingId])

  const start = useCallback((id: string, currentName: string) => {
    setEditingId(id)
    setEditValue(currentName)
  }, [])

  const commit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onCommit(editingId, editValue.trim())
    }
    setEditingId(null)
  }, [editingId, editValue, onCommit])

  const cancel = useCallback(() => setEditingId(null), [])

  /** Spread onto the <input> element for consistent rename behavior. */
  const inputProps = {
    ref: inputRef,
    value: editValue,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') commit()
      if (e.key === 'Escape') cancel()
    },
    onClick: (e: MouseEvent) => e.stopPropagation()
  }

  return { editingId, inputProps, start, commit, cancel }
}
