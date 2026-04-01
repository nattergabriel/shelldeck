/**
 * Layout tree utilities — pure functions for manipulating PaneLayout trees.
 */

import type { PaneLayout } from '@/types'

/** Check whether a session is present anywhere in the layout. */
export function hasPane(layout: PaneLayout, sessionId: string): boolean {
  if (layout.type === 'leaf') return layout.sessionId === sessionId
  if (layout.type === 'placeholder') return false
  return hasPane(layout.children[0], sessionId) || hasPane(layout.children[1], sessionId)
}

/** Check whether the layout contains a placeholder. */
export function hasPlaceholder(layout: PaneLayout): boolean {
  if (layout.type === 'placeholder') return true
  if (layout.type === 'leaf') return false
  return hasPlaceholder(layout.children[0]) || hasPlaceholder(layout.children[1])
}

/** Replace the first placeholder with a leaf. */
export function fillPlaceholder(layout: PaneLayout, sessionId: string): PaneLayout {
  if (layout.type === 'placeholder') return { type: 'leaf', sessionId }
  if (layout.type === 'leaf') return layout
  const left = fillPlaceholder(layout.children[0], sessionId)
  if (left !== layout.children[0]) return { ...layout, children: [left, layout.children[1]] }
  const right = fillPlaceholder(layout.children[1], sessionId)
  if (right !== layout.children[1]) return { ...layout, children: [layout.children[0], right] }
  return layout
}

/**
 * Remove the first node matching a predicate, collapsing its parent split.
 * Returns null if the matched node was the only node in the tree.
 */
function removeNode(layout: PaneLayout, match: (node: PaneLayout) => boolean): PaneLayout | null {
  if (match(layout)) return null
  if (layout.type !== 'split') return layout
  if (match(layout.children[0])) return layout.children[1]
  if (match(layout.children[1])) return layout.children[0]
  const left = removeNode(layout.children[0], match)
  if (left !== layout.children[0]) {
    return left === null ? layout.children[1] : { ...layout, children: [left, layout.children[1]] }
  }
  const right = removeNode(layout.children[1], match)
  if (right !== layout.children[1]) {
    return right === null
      ? layout.children[0]
      : { ...layout, children: [layout.children[0], right] }
  }
  return layout
}

/** Remove a placeholder from the tree, collapsing its parent split. */
export function closePlaceholder(layout: PaneLayout): PaneLayout | null {
  return removeNode(layout, (n) => n.type === 'placeholder')
}

/** Collect all session IDs in the layout. */
export function getAllSessionIds(layout: PaneLayout, acc: string[] = []): string[] {
  if (layout.type === 'leaf') acc.push(layout.sessionId)
  else if (layout.type === 'split') {
    getAllSessionIds(layout.children[0], acc)
    getAllSessionIds(layout.children[1], acc)
  }
  return acc
}

/**
 * Split a leaf node into two panes, adding a placeholder for the new pane.
 * Returns a new tree (immutable).
 */
export function splitPane(
  layout: PaneLayout,
  targetSessionId: string,
  direction: 'horizontal' | 'vertical'
): PaneLayout {
  if (layout.type === 'leaf') {
    if (layout.sessionId === targetSessionId) {
      return {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [layout, { type: 'placeholder' }]
      }
    }
    return layout
  }
  if (layout.type === 'placeholder') return layout
  const left = splitPane(layout.children[0], targetSessionId, direction)
  if (left !== layout.children[0]) return { ...layout, children: [left, layout.children[1]] }
  const right = splitPane(layout.children[1], targetSessionId, direction)
  if (right !== layout.children[1]) return { ...layout, children: [layout.children[0], right] }
  return layout
}

/**
 * Remove a leaf from the tree. The sibling of the removed leaf takes its
 * parent split's place, collapsing the tree upward.
 * Returns null if the removed leaf was the only node.
 */
export function closePane(layout: PaneLayout, sessionId: string): PaneLayout | null {
  return removeNode(layout, (n) => n.type === 'leaf' && n.sessionId === sessionId)
}

/** Replace a leaf's sessionId with a different one. */
export function replacePane(
  layout: PaneLayout,
  oldSessionId: string,
  newSessionId: string
): PaneLayout {
  if (layout.type === 'leaf') {
    return layout.sessionId === oldSessionId ? { type: 'leaf', sessionId: newSessionId } : layout
  }
  if (layout.type === 'placeholder') return layout
  const left = replacePane(layout.children[0], oldSessionId, newSessionId)
  if (left !== layout.children[0]) return { ...layout, children: [left, layout.children[1]] }
  const right = replacePane(layout.children[1], oldSessionId, newSessionId)
  if (right !== layout.children[1]) return { ...layout, children: [layout.children[0], right] }
  return layout
}

/**
 * Update the ratio of a split node identified by a path of child indices.
 * path = [] means update the root; [0] means the first child, etc.
 */
export function updateRatio(layout: PaneLayout, path: number[], ratio: number): PaneLayout {
  if (path.length === 0) {
    if (layout.type !== 'split') return layout
    return { ...layout, ratio }
  }
  if (layout.type !== 'split') return layout
  const [head, ...rest] = path
  const children: [PaneLayout, PaneLayout] = [...layout.children]
  children[head] = updateRatio(children[head], rest, ratio)
  return { ...layout, children }
}

/**
 * Find the first leaf sessionId that is adjacent to the target in a given
 * direction. Used for Cmd+Option+Arrow pane navigation.
 */
export function findAdjacentPane(
  layout: PaneLayout,
  currentSessionId: string,
  direction: 'left' | 'right' | 'up' | 'down'
): string | null {
  const leaves = getAllSessionIds(layout)
  const idx = leaves.indexOf(currentSessionId)
  if (idx === -1) return null

  // Simple linear navigation: left/up = previous leaf, right/down = next leaf.
  if (direction === 'left' || direction === 'up') {
    return idx > 0 ? leaves[idx - 1] : null
  }
  return idx < leaves.length - 1 ? leaves[idx + 1] : null
}
