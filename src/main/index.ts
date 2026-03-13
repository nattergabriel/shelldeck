/**
 * Electron main process entry point.
 *
 * Responsibilities:
 * - Create the BrowserWindow
 * - Register IPC handlers for PTY and dialog operations
 * - Start the system monitor
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { SystemMonitor } from './system-monitor'
import { loadProjects, saveProjects } from './store'
import { IPC } from '../shared/types'

const ptyManager = new PtyManager()
const systemMonitor = new SystemMonitor()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
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
