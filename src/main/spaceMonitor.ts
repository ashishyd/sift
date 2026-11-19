import { Notification, type BrowserWindow } from 'electron'
import { listRootVolume } from './scanner'
import { getScanPreferences } from './config'
import { getLastScanSummary } from './tray'
import { requestAutoScan } from './autoScan'
import type { ScanPreferences } from '../shared/types'

/** Poll quickly while someone can see the window; a closed window only needs drop detection. */
const POLL_VISIBLE_MS = 60 * 1000
const POLL_HIDDEN_MS = 5 * 60 * 1000
const GB = 1024 ** 3
/** While space stays low, remind at most this often. */
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000
/** Free space must climb this far above the threshold before the alert re-arms. */
const REARM_MARGIN = 1.1

export interface AlertState {
  armed: boolean
  lastAlertAt: number | null
}

/** Pure alert decision: fire on crossing below, re-arm only after a clear recovery, and rate-limit reminders. */
export function evaluateAlert(
  freeBytes: number,
  thresholdBytes: number,
  state: AlertState,
  now: number
): { alert: boolean; next: AlertState } {
  if (freeBytes >= thresholdBytes * REARM_MARGIN) return { alert: false, next: { armed: true, lastAlertAt: null } }
  if (freeBytes >= thresholdBytes) return { alert: false, next: state }
  const due = state.armed || (state.lastAlertAt !== null && now - state.lastAlertAt >= REMIND_AFTER_MS)
  if (!due) return { alert: false, next: state }
  return { alert: true, next: { armed: false, lastAlertAt: now } }
}

let state: AlertState = { armed: true, lastAlertAt: null }
let timer: ReturnType<typeof setTimeout> | null = null
let polling = false
let getWindow: () => BrowserWindow | null = () => null
let peekWindow: () => BrowserWindow | null = () => null

async function maybeAlert(free: number, prefs: ScanPreferences): Promise<void> {
  const { alert, next } = evaluateAlert(free, prefs.lowSpaceThresholdGb * GB, state, Date.now())
  state = next
  if (!alert) return

  const reclaimable = (await getLastScanSummary())?.reclaimableBytes ?? 0
  const freeLabel = `${(free / GB).toFixed(1)} GB`
  const n = new Notification({
    title: `Low disk space — ${freeLabel} free`,
    body:
      reclaimable > 0
        ? `Below your ${prefs.lowSpaceThresholdGb} GB limit. Sift found about ${(reclaimable / GB).toFixed(1)} GB you can clear.`
        : `Below your ${prefs.lowSpaceThresholdGb} GB limit. Open Sift to see what you can clear.`
  })
  n.on('click', () => {
    const win = getWindow()
    if (!win) return
    win.show()
    win.focus()
    // A window recreated from the background is still loading; the renderer isn't listening yet.
    const send = (): void => win.webContents.send('sift:navigate', 'dashboard')
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  })
  // Show now with the cached figure; the rescan below takes minutes.
  n.show()
  void requestAutoScan('low-space', free)
}

export async function checkSpaceNow(): Promise<void> {
  const { free } = await listRootVolume()
  if (free <= 0) return

  const prefs = await getScanPreferences()
  if (prefs.lowSpaceAlertsEnabled && Notification.isSupported()) await maybeAlert(free, prefs)
  void requestAutoScan('space-drop', free)
}

/** `windowGetter` may create the window (notification click); `peek` must not. */
export function startSpaceMonitor(
  windowGetter: () => BrowserWindow | null,
  peek: () => BrowserWindow | null
): void {
  getWindow = windowGetter
  peekWindow = peek
  if (timer) clearTimeout(timer)
  const tick = (): void => {
    // run() has no timeout, so a stuck df must not stack up behind the next tick
    if (!polling) {
      polling = true
      checkSpaceNow()
        .catch(() => {
          // best-effort; a failed df must never disturb the app
        })
        .finally(() => {
          polling = false
        })
    }
    const win = peekWindow()
    const visible = !!win && !win.isDestroyed() && win.isVisible()
    timer = setTimeout(tick, visible ? POLL_VISIBLE_MS : POLL_HIDDEN_MS)
  }
  tick()
}
