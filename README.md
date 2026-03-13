<h3 align="center">shelldeck</h3>

<p align="center">
  Multi-terminal dashboard for managing concurrent shell sessions by project.<br>
  Built for running multiple coding agents side by side.
</p>

<p align="center">
  <a href="https://github.com/etaaa/shelldeck/actions/workflows/ci.yml"><img src="https://github.com/etaaa/shelldeck/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/etaaa/shelldeck/blob/main/LICENSE"><img src="https://img.shields.io/github/license/etaaa/shelldeck" alt="License" /></a>
  <!-- <a href="https://github.com/etaaa/shelldeck/releases"><img src="https://img.shields.io/github/v/release/etaaa/shelldeck?include_prereleases" alt="Release" /></a> -->
</p>

---

<p align="center">
  <img src=".github/screenshot.png" alt="shelldeck screenshot" width="800" />
</p>

Running CLI-based coding agents (Claude Code, Codex, Aider, etc.) across multiple projects means juggling a lot of terminal windows. shelldeck gives you a single dashboard where each project gets its own group of terminals, all starting in the right directory. Switch between agents without losing output, restart crashed sessions in one click, and see system resource usage at a glance.

It works just as well for general terminal workflows, but the multi-agent use case is what motivated it.

## Features

- **Project-based organization:** group terminals by project folder
- **Persistent layout:** projects and terminal sessions survive app restarts
- **Output preservation:** switch between terminals without losing scrollback
- **Drag-and-drop:** reorder projects in the sidebar
- **Terminal search:** find text in scrollback with Cmd/Ctrl+F
- **Keyboard shortcuts:** new terminal, switch sessions, close, all from the keyboard
- **System monitoring:** CPU and memory usage in the status bar
- **Cross-platform:** macOS, Linux, Windows

## Getting started

You need Node.js 20+ installed.

```bash
git clone https://github.com/etaaa/shelldeck.git
cd shelldeck
npm install
npm run dev
```

The `postinstall` script automatically compiles `node-pty` native bindings for your platform via `electron-rebuild`.

## Usage

1. Click **Add Project** in the sidebar and select a local folder.
2. Hover over a project and click **+** to open a new terminal. The shell starts in that project's directory.
3. Click terminal entries in the sidebar to switch between sessions. Output is preserved in the background.
4. Double-click a terminal name in the sidebar to rename it.
5. Use the restart button in the header or **STOP ALL** in the status bar to manage running terminals.

Projects and terminal session metadata persist across restarts.

## Building for distribution

```bash
npm run build:dist
```

This produces platform-specific installers in the `dist/` directory: `.dmg` for macOS, `.AppImage`/`.deb` for Linux, `.exe` for Windows.

To build only the Vite bundles without packaging:

```bash
npm run build
```

## Tech stack

- **Electron** with strict context isolation (no Node.js in the renderer)
- **React 18** with Context + useReducer for state management
- **xterm.js** for terminal rendering, **node-pty** for backend pseudoterminals
- **Tailwind CSS** with shadcn/ui component patterns
- **electron-vite** for bundling main, preload, and renderer processes
- **electron-builder** for packaging and distribution

## Architecture

The app follows Electron's recommended security model with three isolated layers:

- **Main process** (`src/main/`) handles PTY spawning, system monitoring, file persistence, and native dialogs.
- **Preload script** (`src/preload/`) exposes a typed API surface via `contextBridge`. This is the only bridge between main and renderer.
- **Renderer** (`src/renderer/`) is a standard React app. It communicates with the main process exclusively through `window.shellDeck`.

All IPC channel names and shared types live in `src/shared/types.ts` as the single source of truth.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build Vite bundles to `out/` |
| `npm run build:dist` | Build and package for distribution |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |

## Contributing

1. Fork the repo and create a feature branch.
2. Run `npm run lint` and `npm run format` before committing.
3. Open a pull request against `main`.

## License

[MIT](LICENSE)
