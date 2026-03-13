# shelldeck

A multi-terminal dashboard for managing concurrent terminal sessions across different project workspaces. Built with Electron, React, and xterm.js.

shelldeck lets you organize terminals by project. Each project maps to a local folder, and every terminal you open under that project starts in the correct directory. Switching between terminals preserves output, so you never lose context.

## Getting started

You need Node.js 20+ installed.

```bash
git clone https://github.com/your-username/shelldeck.git
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
5. Use the header buttons to restart or kill individual terminals, or hit **STOP ALL** in the status bar to terminate everything.

Projects persist across restarts. Terminal sessions do not (they are ephemeral by design).

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
