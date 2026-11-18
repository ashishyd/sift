import { describe, expect, it } from 'vitest'
import { riskTotals } from './reclaimable'
import type { CategoryResult } from './types'

const cat = (
  id: string,
  risk: CategoryResult['risk'],
  totalSizeBytes: number,
  missing = false
): CategoryResult =>
  ({
    id,
    label: id,
    description: '',
    risk,
    items: [],
    totalSizeBytes,
    missing
  }) as unknown as CategoryResult

describe('riskTotals', () => {
  it('sums uncapped totals per risk and skips trash and missing categories', () => {
    const totals = riskTotals([
      cat('xcode-derived-data', 'safe', 100),
      cat('app-caches', 'safe', 50),
      cat('ios-device-support', 'caution', 30),
      cat('orphaned-dmgs', 'review', 20),
      cat('trash', 'safe', 999),
      cat('docker', 'caution', 400, true)
    ])
    expect(totals).toEqual({ safe: 150, caution: 30, review: 20 })
  })
})
