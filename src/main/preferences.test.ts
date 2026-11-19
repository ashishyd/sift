import { describe, expect, it } from 'vitest'
import {
  categoryHiddenStats,
  normalizeScanPreferences,
  DEFAULT_SCAN_PREFERENCES
} from '../shared/preferences'
import type { CategoryResult, ScanItem } from '../shared/types'

function item(path: string, sizeBytes: number): ScanItem {
  return {
    path,
    name: path.split('/').pop()!,
    sizeBytes,
    isDirectory: false,
    lastAccessed: null,
    lastModified: null
  }
}

describe('normalizeScanPreferences', () => {
  it('fills defaults for empty input', () => {
    expect(normalizeScanPreferences(null)).toEqual(DEFAULT_SCAN_PREFERENCES)
  })

  it('clamps out-of-range values', () => {
    const prefs = normalizeScanPreferences({
      largeFileMinMb: 1,
      backgroundScanHours: 999
    })
    expect(prefs.largeFileMinMb).toBe(50)
    expect(prefs.backgroundScanHours).toBe(168)
  })
})

describe('categoryHiddenStats', () => {
  it('reports uncapped remainder', () => {
    const category: CategoryResult = {
      id: 'a',
      label: 'a',
      description: '',
      risk: 'safe',
      items: [item('/a/1', 100)],
      totalSizeBytes: 350,
      matchedItemCount: 4,
      missing: false,
      permissionDenied: false
    }
    expect(categoryHiddenStats(category)).toEqual({ count: 3, bytes: 250 })
  })
})

describe('low-space prefs', () => {
  it('defaults on at 20 GB and clamps', () => {
    const d = normalizeScanPreferences(null)
    expect(d.lowSpaceAlertsEnabled).toBe(true)
    expect(d.lowSpaceThresholdGb).toBe(20)
    expect(normalizeScanPreferences({ lowSpaceThresholdGb: 0 }).lowSpaceThresholdGb).toBe(1)
  })

  it('auto-scan defaults on at 5 GB, fills old configs, and clamps', () => {
    const d = normalizeScanPreferences({ backgroundScanHours: 4 })
    expect(d.autoScanEnabled).toBe(true)
    expect(d.autoScanDropGb).toBe(5)
    expect(normalizeScanPreferences({ autoScanDropGb: 0 }).autoScanDropGb).toBe(1)
    expect(normalizeScanPreferences({ autoScanDropGb: 9999 }).autoScanDropGb).toBe(500)
    expect(normalizeScanPreferences({ autoScanDropGb: NaN }).autoScanDropGb).toBe(5)
    expect(
      normalizeScanPreferences({ autoScanEnabled: 'yes' as unknown as boolean }).autoScanEnabled
    ).toBe(true)
    expect(normalizeScanPreferences({ autoScanEnabled: false }).autoScanEnabled).toBe(false)
  })
})
