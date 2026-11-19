export type AutoScanTrigger =
  'manual' | 'launch' | 'wake' | 'focus' | 'periodic' | 'space-drop' | 'low-space'

/** No automatic scan starts within this long of the previous attempt (finished or not). */
export const MIN_GAP_MS = 10 * 60 * 1000
/** Window focus only rescans when the data is at least this old. */
export const FOCUS_STALE_MS = 30 * 60 * 1000

export interface AutoScanInput {
  enabled: boolean
  trigger: AutoScanTrigger
  now: number
  lastAttemptAt: number | null
  lastScanAt: number | null
  onBattery: boolean
  freeNow: number | null
  freeAtLastScan: number | null
  dropBytes: number
}

export type AutoScanDecision =
  | { run: true }
  | {
      run: false
      reason: 'disabled' | 'no-baseline' | 'too-soon' | 'on-battery' | 'fresh' | 'no-drop'
    }

/** Pure gate for every scan the app starts on its own. `manual` always runs. */
export function decideAutoScan(i: AutoScanInput): AutoScanDecision {
  if (i.trigger === 'manual') return { run: true }
  // periodic predates the master toggle: it is governed by backgroundScanHours alone
  if (!i.enabled && i.trigger !== 'periodic') return { run: false, reason: 'disabled' }
  // No scan yet means macOS permission prompts have not been seen: only launch (30 s delay)
  // and periodic may start the first one, never wake, focus or a space change.
  if (i.lastScanAt === null && i.trigger !== 'launch' && i.trigger !== 'periodic') {
    return { run: false, reason: 'no-baseline' }
  }
  if (i.lastAttemptAt !== null && i.now - i.lastAttemptAt < MIN_GAP_MS) {
    return { run: false, reason: 'too-soon' }
  }
  if (i.onBattery && i.trigger !== 'launch' && i.trigger !== 'low-space') {
    return { run: false, reason: 'on-battery' }
  }
  if (i.trigger === 'focus' && i.lastScanAt !== null && i.now - i.lastScanAt < FOCUS_STALE_MS) {
    return { run: false, reason: 'fresh' }
  }
  if (i.trigger === 'space-drop') {
    if (i.freeNow === null || i.freeAtLastScan === null) return { run: false, reason: 'no-drop' }
    if (i.freeAtLastScan - i.freeNow < i.dropBytes) return { run: false, reason: 'no-drop' }
  }
  return { run: true }
}
