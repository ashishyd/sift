import { Tray, Menu, nativeImage, app, type BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import trayIconAsset from '../../resources/trayTemplate.png?asset'
import trayIconAsset2x from '../../resources/trayTemplate@2x.png?asset'
import { runFullScan } from './scanner'
import { getIgnoredPaths } from './config'
import type { ScanSummary } from '../shared/types'

const BACKGROUND_SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const FIRST_SCAN_DELAY_MS = 30 * 1000 // let the app settle before any TCC prompts can fire

let tray: Tray | null = null
let lastSummary: ScanSummary | null = null

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

export function getLastScanSummary(): ScanSummary | null {
  return lastSummary
}

async function runBackgroundScan(): Promise<void> {
  try {
    const ignored = await getIgnoredPaths()
    lastSummary = await runFullScan(undefined, ignored)
    tray?.setTitle(` ${formatBytesShort(lastSummary.reclaimableBytes)}`)
  } catch {
    // background scan is best-effort — a failure here shouldn't surface anywhere disruptive
  }
}

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
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
          await runBackgroundScan()
          rebuildMenu()
          showWindow()
        }
      },
      { type: 'separator' },
      { label: 'Quit Sift', click: () => app.quit() }
    ])
    tray?.setContextMenu(menu)
  }

  rebuildMenu()
  tray.on('click', showWindow)

  setTimeout(() => {
    runBackgroundScan().then(rebuildMenu)
  }, FIRST_SCAN_DELAY_MS)
  setInterval(() => {
    runBackgroundScan().then(rebuildMenu)
  }, BACKGROUND_SCAN_INTERVAL_MS)

  return tray
}
