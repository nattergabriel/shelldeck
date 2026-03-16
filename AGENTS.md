# AGENTS.md

This file provides guidance to AI coding agents working with this repository.

## Commands

- `npm run dev` — Start Tauri dev server (Vite + Rust hot reload)
- `npm run build` — Build Vite frontend to `dist/`
- `npm run build:dist` — Build and package for distribution via `tauri build`
- `npm run lint` — Run ESLint (flat config, `eslint.config.mjs`)
- `npm run format` — Format with Prettier
- `npm run format:check` — Check formatting without writing

No test runner is configured yet.

## Architecture

shelldeck is a Tauri v2 app with a React frontend and Rust backend:

**Rust backend** (`src-tauri/src/`) — Modular backend split into focused files:
- `pty.rs` — PTY management using `portable-pty`. Async commands via Tokio for spawn, read, write, resize, kill, and cleanup.
- `store.rs` — JSON file persistence for projects, sessions, and settings in the Tauri app data dir.
- `menu.rs` — Native app menu with check-for-updates support.
- `lib.rs` — Tauri setup, plugin registration, and command handler.

**Frontend** (`src/`) — React app with xterm.js:
- `context/terminal-context.tsx` — Projects and sessions state via useReducer.
- `context/settings-context.tsx` — App settings (sidebar width, notifications) with auto-persistence.
- `context/terminal-manager.tsx` — Provides xterm.js terminal manager globally (wraps the hook in a context to avoid prop drilling).
- `hooks/use-terminal.ts` — Terminal lifecycle: xterm.js instances, PTY attach/detach, fit, search, bell detection. Consumed by `TerminalManagerProvider`.
- `hooks/use-inline-rename.ts` — Reusable inline rename behavior (shared by ProjectList and TerminalList).
- `hooks/use-drag-reorder.ts` — Pointer-based drag-to-reorder for vertical lists (used by ProjectList).
- `hooks/use-keyboard-shortcuts.ts` — Global shortcuts (Cmd+T, Cmd+W, Cmd+Shift+[/], Cmd+1-9).
- `hooks/use-auto-update.ts` — Checks for updates on launch.
- `components/sidebar/` — Project list, terminal list, resize handle.
- `components/workspace/` — Terminal view, header, search bar, idle screen.
- `components/settings/` — Settings panel with sidebar navigation.
- `components/ui/` — shadcn/ui primitives (button, switch, context-menu).

**Types** (`src/types.ts`) — Single source of truth for shared data types (Project, TerminalSession, AppSettings, SettingsCategory, TerminalManager).

**API bridge** (`src/lib/api.ts`) — Centralizes all Tauri communication. All operations (PTY, store, dialog, fs) go through `invoke()` commands to the Rust backend.

## Adding a New Tauri Command

1. Write the command function in the appropriate Rust module (`src-tauri/src/`)
2. Register it in `src-tauri/src/lib.rs` via `invoke_handler`
3. Add permissions in `src-tauri/capabilities/default.json` if needed
4. Call from frontend via `invoke('command_name', { args })` in `src/lib/api.ts`

## Terminal Lifecycle

Terminal instances are managed by `TerminalManagerProvider` (`src/context/terminal-manager.tsx`), which wraps the `useTerminalManager` hook (`src/hooks/use-terminal.ts`) in a React context. Components access it via `useTerminalManager()` from the context — no prop drilling. The hook keeps a persistent `Map<sessionId, {terminal, fitAddon}>` in a ref. All xterm.js containers are rendered simultaneously in absolute-positioned divs — only the active one is visible (`display: block` vs `none`). This preserves terminal output when switching sessions.

PTY processes are spawned via `invoke('pty_spawn')` to the Rust backend, which uses `portable-pty` under the hood. Data flows between the frontend and Rust via `invoke('pty_read')` / `invoke('pty_write')` calls.

## Code Style

- Keep code simple, readable, and modular. Avoid over-engineering.
- Prefer small, focused files and functions over large monolithic ones.
- Use `@/` path alias for all imports — avoid deep relative paths.
- Tailwind CSS with dark mode (class strategy), CSS variables for shadcn/ui theming.
- shadcn/ui pattern — components in `src/components/ui/` using CVA for variants.
- Icons from lucide-react.
- Keep it idiomatic for Tauri. No Electron patterns (preload, IPC channels, process separation).
