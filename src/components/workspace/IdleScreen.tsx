/**
 * IdleScreen — shown when no terminal session is active.
 * Displays usage hints for getting started.
 */

import { Plus, FolderOpen } from 'lucide-react'

const hints = [
  { icon: FolderOpen, label: 'Add or select a workspace', description: 'from the sidebar' },
  { icon: Plus, label: 'Open a terminal', description: 'to start working' }
]

export function IdleScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {/* Logo mark as subtle visual anchor */}
        <svg viewBox="0 0 512 512" className="w-12 h-12 opacity-15" fill="none">
          <path
            d="M 144 148 L 296 256 L 144 364"
            stroke="currentColor"
            strokeWidth="56"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="328"
            y1="364"
            x2="400"
            y2="364"
            stroke="currentColor"
            strokeWidth="56"
            strokeLinecap="round"
          />
        </svg>

        <div className="flex flex-col gap-3 w-full">
          <p className="text-sm text-muted-foreground text-center mb-1">
            No active terminal session.
          </p>
          {hints.map((hint) => (
            <div
              key={hint.label}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30"
            >
              <hint.icon className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{hint.label}</span> {hint.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
