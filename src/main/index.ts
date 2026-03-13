/**
 * Electron main process entry point.
 *
 * Responsibilities:
 * - Create the BrowserWindow
 * - Register IPC handlers for PTY and dialog operations
 * - Start the system monitor
 * - Persist and restore window state
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { PtyManager } from './pty-manager'
import { SystemMonitor } from './system-monitor'
import {
  loadProjects,
  saveProjects,
  loadSessions,
  saveSessions,
  loadSettings,
  saveSettings,
  AppSettings
} from './store'
import { IPC } from '../shared/types'

const ptyManager = new PtyManager()
const systemMonitor = new SystemMonitor()
let settings: AppSettings = {}

function createWindow(): BrowserWindow {
  settings = loadSettings()
  const bounds = settings.windowBounds

  const win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b', // zinc-950
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Required for node-pty preload bridge
    }
  })

  if (settings.windowIsMaximized) {
    win.maximize()
  }

  // Save window state on move, resize, and maximize/unmaximize.
  const saveWindowState = () => {
    if (win.isDestroyed()) return
    const isMaximized = win.isMaximized()
    settings.windowIsMaximized = isMaximized
    if (!isMaximized) {
      settings.windowBounds = win.getBounds()
    }
    saveSettings(settings)
  }

  win.on('resize', saveWindowState)
  win.on('move', saveWindowState)
  win.on('maximize', saveWindowState)
  win.on('unmaximize', saveWindowState)

  // In dev, load the Vite dev server. In prod, load the built HTML.
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** Register all IPC handlers that the renderer can invoke. */
function registerIpcHandlers(): void {
  ipcMain.on(IPC.PTY_SPAWN, (_event, { id, cwd, cols, rows }) => {
    ptyManager.spawn(id, cwd, cols, rows)
  })

  ipcMain.on(IPC.PTY_WRITE, (_event, { id, data }) => {
    ptyManager.write(id, data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_event, { id, cols, rows }) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.on(IPC.PTY_KILL, (_event, { id }) => {
    ptyManager.kill(id)
  })

  ipcMain.on(IPC.PTY_KILL_ALL, () => {
    ptyManager.killAll()
  })

  // Open a native folder picker and return the selected path.
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Project persistence.
  ipcMain.handle(IPC.STORE_GET_PROJECTS, () => loadProjects())
  ipcMain.on(IPC.STORE_SAVE_PROJECTS, (_event, { projects }) => saveProjects(projects))

  // Session persistence.
  ipcMain.handle(IPC.STORE_GET_SESSIONS, () => loadSessions())
  ipcMain.on(IPC.STORE_SAVE_SESSIONS, (_event, { sessions }) => saveSessions(sessions))

  // Settings persistence (sidebar width, etc.).
  ipcMain.handle(IPC.STORE_GET_SETTINGS, () => loadSettings())
  ipcMain.on(IPC.STORE_SAVE_SETTINGS, (_event, incoming) => {
    settings = { ...settings, ...incoming }
    saveSettings(settings)
  })

  // Filesystem checks.
  ipcMain.handle(IPC.FS_PATH_EXISTS, (_event, { path }) => existsSync(path))

  // Terminal context menu (native right-click menu).
  ipcMain.on(IPC.CONTEXT_MENU_TERMINAL, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const menu = Menu.buildFromTemplate([
      {
        label: 'Copy',
        role: 'copy'
      },
      {
        label: 'Paste',
        role: 'paste'
      },
      { type: 'separator' },
      {
        label: 'Clear Terminal',
        click: () => event.sender.send(IPC.CONTEXT_MENU_ACTION, 'clear')
      },
      {
        label: 'Select All',
        role: 'selectAll'
      }
    ])
    menu.popup({ window: win })
  })
}

// --- App lifecycle ---

app.whenReady().then(() => {
  registerIpcHandlers()

  const win = createWindow()
  ptyManager.setWindow(win)
  systemMonitor.start(win)

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows exist.
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow()
      ptyManager.setWindow(newWin)
      systemMonitor.start(newWin)
    }
  })
})

app.on('window-all-closed', () => {
  ptyManager.killAll()
  systemMonitor.stop()
  if (process.platform !== 'darwin') app.quit()
})
