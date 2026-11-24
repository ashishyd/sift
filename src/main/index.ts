import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { listFolder, requestScanCancel } from './scanner'
import { runAndStoreScan, requestAutoScan, startAutoScan } from './autoScan'
import { findDuplicates } from './duplicates'
import { scanAiApps } from './aiApps'
import { scanHiddenSpace, quitApp, deleteSnapshots, deleteSimulatorRuntime } from './hiddenSpace'
import { emptyTrash, moveToTrash } from './trashOps'
import { platform } from './platform'
import { trashName } from '../shared/platform'
import { getSuggestion, askAboutScan, hasClaudeCli, aiBriefPreview } from './ai'
import {
  setApiKey,
  clearApiKey,
  hasApiKey,
  getIgnoredPaths,
  ignorePaths,
  unignorePath,
  getClearHistory,
  appendClearHistory,
  saveLastScan,
  getScanHistory,
  loadLastScan,
  pruneLastScan,
  getScanPreferences,
  setScanPreferences
} from './config'
import { checkAllPermissions, openPrivacySettings, type PrivacyPane } from './permissions'
import { startSpaceMonitor, checkSpaceNow } from './spaceMonitor'
import { createTray, getLastScanSummary, setLastScanSummary, rescheduleBackgroundScan } from './tray'
import { CATEGORY_DEFS } from './categories'
import type { ScanPreferences, ScanSummary } from '../shared/types'
import type { Tray } from 'electron'

let isQuitting = false
/** The window only exists while open — destroying it when closed frees the renderer process (~100+ MB). */
let mainWindow: BrowserWindow | null = null
let trayRef: Tray | null = null

const bin = trashName(platform)

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    mainWindow = null
    // No window left: leave only the menu-bar item, with no Dock icon.
    if (!isQuitting) app.dock?.hide()
  })

  return win
}

/** Returns the open window, creating (or re-showing) it if the app is running in the background. */
function ensureWindow(): BrowserWindow {
  if (!mainWindow) {
    mainWindow = createWindow()
    app.dock?.show()
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

  ensureWindow()

  // Windows keeps running in the notification area like macOS does in the menu bar.
  if (platform !== 'other') {
    trayRef = createTray(ensureWindow, {
      scanNow: async () => {
        try {
          await runAndStoreScan()
        } catch {
          // best-effort from the menu bar
        }
      },
      periodic: () => void requestAutoScan('periodic')
    })
    startAutoScan(() => mainWindow)
    startSpaceMonitor(ensureWindow, () => mainWindow)
  }

  ipcMain.handle('sift:getLastScanSummary', async () => getLastScanSummary())

  ipcMain.handle('sift:scan', async () => runAndStoreScan())

  ipcMain.handle('sift:cancelScan', async () => {
    requestScanCancel()
  })

  ipcMain.handle('sift:listFolder', async (_event, path: string) => listFolder(path))

  ipcMain.handle('sift:findDuplicates', async () => {
    return findDuplicates()
  })

  ipcMain.handle('sift:scanAiApps', async () => scanAiApps())
  ipcMain.handle('sift:scanHiddenSpace', async () => scanHiddenSpace())
  ipcMain.handle('sift:quitApp', async (_event, name: string) => quitApp(name))
  ipcMain.handle('sift:deleteSimulatorRuntime', async (_event, id: string, name: string) =>
    deleteSimulatorRuntime(id, name)
  )
  ipcMain.handle('sift:deleteSnapshots', async (_event, dates: string[]) => deleteSnapshots(dates))

  ipcMain.handle('sift:trash', async (_event, paths: string[]) => {
    const result = await moveToTrash(paths)
    if (result.succeeded.length > 0) {
      await pruneLastScan(result.succeeded)
      const pruned = await loadLastScan()
      if (pruned) setLastScanSummary(pruned)
      await appendClearHistory({
        date: new Date().toISOString(),
        count: result.succeeded.length,
        freedBytes: result.freedBytes
      })
    }
    return result
  })

  ipcMain.handle('sift:emptyTrash', async () => {
    const result = await emptyTrash()
    const summary = await loadLastScan()
    if (summary) {
      const categories = summary.categories.map((c) =>
        c.id === 'trash'
          ? { ...c, items: [], totalSizeBytes: 0, matchedItemCount: 0, missing: false }
          : c
      )
      const next = { ...summary, categories, reclaimableBytes: summary.reclaimableBytes }
      await saveLastScan(next)
      setLastScanSummary(next)
    }
    if (result.freedBytes > 0) {
      await appendClearHistory({
        date: new Date().toISOString(),
        count: 1,
        freedBytes: result.freedBytes
      })
    }
    return result
  })

  ipcMain.handle('sift:getIgnoredPaths', async () => getIgnoredPaths())
  ipcMain.handle('sift:ignorePaths', async (_event, paths: string[]) => ignorePaths(paths))
  ipcMain.handle('sift:unignorePath', async (_event, path: string) => unignorePath(path))
  ipcMain.handle('sift:getClearHistory', async () => getClearHistory())
  ipcMain.handle('sift:getScanHistory', async () => getScanHistory())

  ipcMain.handle('sift:getScanPreferences', async () => getScanPreferences())
  ipcMain.handle('sift:setScanPreferences', async (_event, prefs: Partial<ScanPreferences>) => {
    const next = await setScanPreferences(prefs)
    await rescheduleBackgroundScan()
    await checkSpaceNow()
    return next
  })
  ipcMain.handle('sift:getCategoryDefs', async () =>
    CATEGORY_DEFS.map(({ id, label, risk }) => ({ id, label, risk }))
  )

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
  ipcMain.handle('sift:aiBrief', async () => {
    const summary = await getLastScanSummary()
    return summary ? aiBriefPreview(summary) : ''
  })
  ipcMain.handle('sift:setApiKey', async (_event, key: string) => setApiKey(key))
  ipcMain.handle('sift:clearApiKey', async () => clearApiKey())

  ipcMain.handle('sift:confirmTrash', async (_event, count: number, sizeLabel: string) => {
    const result = await dialog.showMessageBox(ensureWindow(), {
      type: 'warning',
      buttons: [`Move to ${bin}`, 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: `Move to ${bin}?`,
      message: `Move ${count} item(s) to ${bin}?`,
      detail: `This will free up roughly ${sizeLabel}. Items go to ${bin} and can be restored until you empty it.`
    })
    return result.response === 0
  })

  ipcMain.handle('sift:confirmEmptyTrash', async (_event, sizeLabel: string) => {
    const result = await dialog.showMessageBox(ensureWindow(), {
      type: 'warning',
      buttons: [`Empty ${bin}`, 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: `Empty ${bin}?`,
      message: `Permanently delete everything in ${bin}?`,
      detail: `This frees about ${sizeLabel} and cannot be undone. Items currently in ${bin} will be permanently deleted.`
    })
    return result.response === 0
  })

  app.on('activate', function () {
    ensureWindow().show()
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
  // With a tray item (macOS, Windows) closing the window leaves Sift running; only Quit exits.
  if (platform === 'other') {
    app.quit()
  }
})
