import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { runFullScan } from './scanner'
import { findDuplicates } from './duplicates'
import { moveToTrash } from './trashOps'
import { getSuggestion, askAboutScan, hasClaudeCli } from './ai'
import {
  setApiKey,
  clearApiKey,
  hasApiKey,
  getIgnoredPaths,
  ignorePaths,
  unignorePath,
  getClearHistory,
  appendClearHistory
} from './config'
import { checkAllPermissions, openPrivacySettings, type PrivacyPane } from './permissions'
import { createTray, getLastScanSummary } from './tray'
import type { ScanSummary } from '../shared/types'
import type { Tray } from 'electron'

let isQuitting = false
let trayRef: Tray | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Menu-bar companion behavior: closing the window hides it (Tray > Quit Sift is the real exit).
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.sift.desktop')

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  if (process.platform === 'darwin') {
    trayRef = createTray(() => mainWindow)
  }

  ipcMain.handle('sift:getLastScanSummary', async () => getLastScanSummary())

  ipcMain.handle('sift:scan', async (event) => {
    const ignored = await getIgnoredPaths()
    return runFullScan((label, done, total) => {
      event.sender.send('sift:scan-progress', { label, done, total })
    }, ignored)
  })

  ipcMain.handle('sift:findDuplicates', async () => {
    return findDuplicates()
  })

  ipcMain.handle('sift:trash', async (_event, paths: string[]) => {
    const result = await moveToTrash(paths)
    if (result.succeeded.length > 0) {
      await appendClearHistory({
        date: new Date().toISOString(),
        count: result.succeeded.length,
        freedBytes: result.freedBytes
      })
    }
    return result
  })

  ipcMain.handle('sift:getIgnoredPaths', async () => getIgnoredPaths())
  ipcMain.handle('sift:ignorePaths', async (_event, paths: string[]) => ignorePaths(paths))
  ipcMain.handle('sift:unignorePath', async (_event, path: string) => unignorePath(path))
  ipcMain.handle('sift:getClearHistory', async () => getClearHistory())

  ipcMain.handle('sift:revealInFinder', async (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('sift:getAiSuggestion', async (_event, summary: ScanSummary) => getSuggestion(summary))
  ipcMain.handle('sift:askAi', async (_event, summary: ScanSummary, question: string) =>
    askAboutScan(summary, question)
  )

  ipcMain.handle('sift:checkPermissions', async () => checkAllPermissions())
  ipcMain.handle('sift:openPrivacySettings', async (_event, pane: PrivacyPane) => openPrivacySettings(pane))

  ipcMain.handle('sift:hasApiKey', async () => hasApiKey())
  ipcMain.handle('sift:hasClaudeCli', async () => hasClaudeCli())
  ipcMain.handle('sift:setApiKey', async (_event, key: string) => setApiKey(key))
  ipcMain.handle('sift:clearApiKey', async () => clearApiKey())

  ipcMain.handle('sift:confirmTrash', async (_event, count: number, sizeLabel: string) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Move to Trash', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Move to Trash?',
      message: `Move ${count} item(s) to Trash?`,
      detail: `This will free up roughly ${sizeLabel}. Items go to Trash and can be restored until you empty it.`
    })
    return result.response === 0
  })

  app.on('activate', function () {
    const existing = BrowserWindow.getAllWindows()[0]
    if (existing) {
      existing.show()
    } else {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  // Explicitly destroy the status item — an abrupt process exit can otherwise leave a
  // "ghost" icon in the menu bar until the Dock/SystemUIServer restarts.
  trayRef?.destroy()
  trayRef = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
