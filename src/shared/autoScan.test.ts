import { describe, expect, it } from 'vitest'
import {
  decideAutoScan,
  FOCUS_STALE_MS,
  MIN_GAP_MS,
  type AutoScanInput,
  type AutoScanTrigger
} from './autoScan'

const GB = 1024 ** 3
const NOW = 1_000_000_000_000
const base = (trigger: AutoScanTrigger, extra: Partial<AutoScanInput> = {}): AutoScanInput => ({
  enabled: true,
  trigger,
  now: NOW,
  lastAttemptAt: NOW - 2 * MIN_GAP_MS,
  lastScanAt: NOW - 2 * MIN_GAP_MS,
  onBattery: false,
  freeNow: 100 * GB,
  freeAtLastScan: 100 * GB,
  dropBytes: 5 * GB,
  ...extra
})

describe('decideAutoScan', () => {
  it('manual bypasses disabled, gap and battery', () => {
    const d = decideAutoScan(
      base('manual', { enabled: false, lastAttemptAt: NOW, onBattery: true })
    )
    expect(d).toEqual({ run: true })
  })

  it('skips everything but periodic when disabled', () => {
    for (const t of ['launch', 'wake', 'focus', 'space-drop', 'low-space'] as const) {
      expect(decideAutoScan(base(t, { enabled: false }))).toEqual({
        run: false,
        reason: 'disabled'
      })
    }
    expect(decideAutoScan(base('periodic', { enabled: false }))).toEqual({ run: true })
  })

  it('backs off after any attempt, even one that never finished', () => {
    const d = decideAutoScan(
      base('wake', { lastAttemptAt: NOW - MIN_GAP_MS + 1, lastScanAt: NOW - 24 * 3_600_000 })
    )
    expect(d).toEqual({ run: false, reason: 'too-soon' })
    expect(decideAutoScan(base('wake', { lastAttemptAt: NOW - MIN_GAP_MS })).run).toBe(true)
  })

  it('skips on battery except launch and low-space', () => {
    for (const t of ['wake', 'focus', 'periodic', 'space-drop'] as const) {
      const extra = t === 'space-drop' ? { onBattery: true, freeNow: 90 * GB } : { onBattery: true }
      expect(decideAutoScan(base(t, extra))).toEqual({ run: false, reason: 'on-battery' })
    }
    expect(decideAutoScan(base('launch', { onBattery: true })).run).toBe(true)
    expect(decideAutoScan(base('low-space', { onBattery: true })).run).toBe(true)
  })

  it('focus runs only when the scan is stale', () => {
    expect(decideAutoScan(base('focus', { lastScanAt: NOW - FOCUS_STALE_MS + 1 }))).toEqual({
      run: false,
      reason: 'fresh'
    })
    expect(decideAutoScan(base('focus', { lastScanAt: NOW - FOCUS_STALE_MS })).run).toBe(true)
  })

  it('never scans on its own before a first scan exists, except launch and periodic', () => {
    for (const t of ['wake', 'focus', 'space-drop', 'low-space'] as const) {
      expect(decideAutoScan(base(t, { lastScanAt: null }))).toEqual({
        run: false,
        reason: 'no-baseline'
      })
    }
    expect(decideAutoScan(base('launch', { lastScanAt: null })).run).toBe(true)
    expect(decideAutoScan(base('periodic', { lastScanAt: null })).run).toBe(true)
    expect(decideAutoScan(base('manual', { lastScanAt: null })).run).toBe(true)
  })

  it('space-drop runs only on a drop at or over the threshold', () => {
    expect(decideAutoScan(base('space-drop', { freeNow: 96 * GB }))).toEqual({
      run: false,
      reason: 'no-drop'
    })
    expect(decideAutoScan(base('space-drop', { freeNow: 95 * GB })).run).toBe(true)
  })

  it('space-drop does not run without both free-space values', () => {
    expect(decideAutoScan(base('space-drop', { freeNow: null }))).toEqual({
      run: false,
      reason: 'no-drop'
    })
    expect(decideAutoScan(base('space-drop', { freeAtLastScan: null }))).toEqual({
      run: false,
      reason: 'no-drop'
    })
  })
})
