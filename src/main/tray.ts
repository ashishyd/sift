import { Tray, Menu, nativeImage, app, type BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import trayIconAsset from '../../resources/trayTemplate.png?asset'
import trayIconAsset2x from '../../resources/trayTemplate@2x.png?asset'
import { getScanPreferences, loadLastScan } from './config'
import type { ScanSummary } from '../shared/types'

export interface TrayHooks {
  /** "Scan Now": always runs, even inside the automatic-scan gap. */
  scanNow: () => Promise<void>
  /** The periodic background timer fired. */
  periodic: () => void
}

let tray: Tray | null = null
let lastSummary: ScanSummary | null = null
let backgroundTimer: ReturnType<typeof setTimeout> | null = null
let rebuildMenuRef: (() => void) | null = null
let hooksRef: TrayHooks | null = null

function formatBytesShort(n: number): string {
  if (n <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export async function getLastScanSummary(): Promise<ScanSummary | null> {
  if (!lastSummary) lastSummary = await loadLastScan()
  return lastSummary
}

export function setLastScanSummary(summary: ScanSummary): void {
  lastSummary = summary
  tray?.setTitle(` ${formatBytesShort(summary.reclaimableBytes)}`)
  rebuildMenuRef?.()
}

function scheduleBackgroundScan(delayMs: number): void {
  if (backgroundTimer) clearTimeout(backgroundTimer)
  backgroundTimer = setTimeout(async () => {
    hooksRef?.periodic()
    const prefs = await getScanPreferences()
    scheduleBackgroundScan(prefs.backgroundScanHours * 60 * 60 * 1000)
  }, delayMs)
}

/** After Settings change the background interval, restart the timer from now. */
export async function rescheduleBackgroundScan(): Promise<void> {
  if (!tray) return
  const prefs = await getScanPreferences()
  scheduleBackgroundScan(prefs.backgroundScanHours * 60 * 60 * 1000)
}

export function createTray(getMainWindow: () => BrowserWindow | null, hooks: TrayHooks): Tray {
  hooksRef = hooks
  const icon = nativeImage.createFromPath(trayIconAsset)
  icon.addRepresentation({ scaleFactor: 2, buffer: readFileSync(trayIconAsset2x) })
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Sift — know before you clear.')

  const showWindow = (): void => {
    const win = getMainWindow()
    if (win) {
      win.show()
      win.focus()
    }
  }

  const rebuildMenu = (): void => {
    const menu = Menu.buildFromTemplate([
      {
        label: lastSummary
          ? `${formatBytesShort(lastSummary.reclaimableBytes)} reclaimable`
          : 'No scan yet',
        enabled: false
      },
      { type: 'separator' },
      { label: 'Open Sift', click: showWindow },
      {
        label: 'Scan Now',
        click: async () => {
          await hooks.scanNow()
          showWindow()
        }
      },
      { type: 'separator' },
      { label: 'Quit Sift', click: () => app.quit() }
    ])
    tray?.setContextMenu(menu)
  }

  rebuildMenuRef = rebuildMenu
  rebuildMenu()
  loadLastScan().then((cached) => {
    if (cached && !lastSummary) {
      lastSummary = cached
      tray?.setTitle(` ${formatBytesShort(cached.reclaimableBytes)}`)
      rebuildMenu()
    }
  })
  tray.on('click', showWindow)

  // The launch scan belongs to autoScan.ts; this timer only covers the long interval.
  getScanPreferences().then((prefs) =>
    scheduleBackgroundScan(prefs.backgroundScanHours * 60 * 60 * 1000)
  )

  return tray
}
