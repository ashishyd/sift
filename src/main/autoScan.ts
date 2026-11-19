import { app, powerMonitor, type BrowserWindow } from 'electron'
import { isScanInFlight, runFullScan } from './scanner'
import {
  appendScanSnapshot,
  getIgnoredPaths,
  getScanPreferences,
  loadLastScan,
  saveLastScan
} from './config'
import { getLastScanSummary, setLastScanSummary } from './tray'
import { decideAutoScan, type AutoScanTrigger } from '../shared/autoScan'
import type { ScanSummary } from '../shared/types'

const GB = 1024 ** 3
const LAUNCH_DELAY_MS = 3 * 1000
/** First run: let the app settle before any TCC prompt can fire. */
const LAUNCH_DELAY_NO_CACHE_MS = 30 * 1000
const WAKE_DELAY_MS = 5 * 1000
const FOCUS_DEBOUNCE_MS = 1000

let getWindow: () => BrowserWindow | null = () => null
let lastAttemptAt: number | null = null

/** Sends to the window only if one exists; a background trigger must never create one. */
function pushToWindow(channel: string, payload: unknown, waitForLoad = false): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  const send = (): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  if (!win.webContents.isLoading()) send()
  else if (waitForLoad) win.webContents.once('did-finish-load', send)
}

/**
 * The one place a scan starts. Progress is broadcast by whichever call actually starts it,
 * because runFullScan ignores the callback of a caller that joins a scan already running.
 */
export async function startScan(): Promise<ScanSummary> {
  const [ignored, prefs] = await Promise.all([getIgnoredPaths(), getScanPreferences()])
  if (isScanInFlight()) return runFullScan()
  lastAttemptAt = Date.now()
  pushToWindow('sift:scan-state', { running: true })
  return runFullScan(
    (label, done, total) => pushToWindow('sift:scan-progress', { label, done, total }),
    ignored,
    prefs
  ).finally(() => pushToWindow('sift:scan-state', { running: false }))
}

/** Scan, then store the result everywhere it lives and tell an open window. */
export async function runAndStoreScan(): Promise<ScanSummary> {
  const summary = await startScan()
  setLastScanSummary(summary)
  await saveLastScan(summary)
  await appendScanSnapshot(summary)
  pushToWindow('sift:scan-updated', summary, true)
  return summary
}

/** Start a scan if the rules allow it. Never throws: automatic scans are best-effort. */
export async function requestAutoScan(trigger: AutoScanTrigger, freeNow?: number): Promise<void> {
  try {
    const prefs = await getScanPreferences()
    const last = await getLastScanSummary()
    const decision = decideAutoScan({
      enabled: prefs.autoScanEnabled,
      trigger,
      now: Date.now(),
      lastAttemptAt,
      lastScanAt: last ? Date.parse(last.scannedAt) : null,
      onBattery: powerMonitor.isOnBatteryPower(),
      freeNow: freeNow ?? null,
      freeAtLastScan: last?.volumeFreeBytes ?? null,
      dropBytes: prefs.autoScanDropGb * GB
    })
    if (decision.run) await runAndStoreScan()
  } catch {
    // includes a cancelled scan; the gap already backs off
  }
}

export function startAutoScan(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter

  loadLastScan().then((cached) => {
    setTimeout(
      () => void requestAutoScan('launch'),
      cached ? LAUNCH_DELAY_MS : LAUNCH_DELAY_NO_CACHE_MS
    )
  })

  powerMonitor.on('resume', () => {
    setTimeout(() => void requestAutoScan('wake'), WAKE_DELAY_MS)
  })

  let focusTimer: ReturnType<typeof setTimeout> | null = null
  app.on('browser-window-focus', () => {
    if (focusTimer) clearTimeout(focusTimer)
    focusTimer = setTimeout(() => void requestAutoScan('focus'), FOCUS_DEBOUNCE_MS)
  })
}
