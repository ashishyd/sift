import { describe, expect, it } from 'vitest'
import { appendSnapshot, categoryGrowth, daysUntilFull, snapshotOf } from './growth'
import type { CategoryResult, ScanSnapshot, ScanSummary } from './types'

const GB = 1024 ** 3
const snap = (
  at: string,
  freeGb: number,
  categories: Record<string, number> = {}
): ScanSnapshot => ({
  at,
  totalBytes: 500 * GB,
  freeBytes: freeGb * GB,
  categories
})

describe('snapshotOf', () => {
  it('uses uncapped totals and drops missing and permission-denied categories', () => {
    const cat = (id: string, size: number, extra: Partial<CategoryResult>): CategoryResult =>
      ({
        id,
        totalSizeBytes: size,
        items: [],
        missing: false,
        permissionDenied: false,
        ...extra
      }) as CategoryResult
    const s = snapshotOf({
      scannedAt: '2026-11-01T00:00:00Z',
      volumeTotalBytes: 10,
      volumeFreeBytes: 4,
      volumes: [],
      reclaimableBytes: 0,
      categories: [
        cat('a', 100, {}),
        cat('b', 0, { missing: true }),
        cat('c', 0, { permissionDenied: true })
      ]
    } as ScanSummary)
    expect(s.categories).toEqual({ a: 100 })
    expect(s.freeBytes).toBe(4)
  })
})

describe('appendSnapshot', () => {
  it('replaces a scan taken within an hour and caps the list at 90', () => {
    const a = snap('2026-11-01T10:00:00Z', 100)
    const b = snap('2026-11-01T10:30:00Z', 99)
    expect(appendSnapshot([a], b)).toEqual([{ ...b, at: a.at }])
    const many = Array.from({ length: 90 }, (_, i) =>
      snap(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, i)
    )
    const out = appendSnapshot(many, snap('2026-12-01T00:00:00Z', 1))
    expect(out).toHaveLength(90)
    expect(out[89].freeBytes).toBe(GB)
  })

  it('keeps adding points when scans arrive less than an hour apart', () => {
    let list: ScanSnapshot[] = []
    for (const at of ['10:00', '10:40', '11:20', '12:00']) {
      list = appendSnapshot(list, snap(`2026-11-01T${at}:00Z`, 100))
    }
    expect(list.map((s) => s.at)).toEqual(['2026-11-01T10:00:00Z', '2026-11-01T11:20:00Z'])
  })
})

describe('categoryGrowth', () => {
  it('sorts by growth and ignores categories absent from either scan', () => {
    const prev = snap('2026-11-01T00:00:00Z', 100, { a: 10, b: 50, gone: 5, same: 7 })
    const curr = snap('2026-11-08T00:00:00Z', 90, { a: 12, b: 40, new: 9, same: 7 })
    expect(categoryGrowth(prev, curr)).toEqual([
      { id: 'a', deltaBytes: 2 },
      { id: 'b', deltaBytes: -10 }
    ])
  })
})

describe('daysUntilFull', () => {
  it('projects from the free-space slope', () => {
    // lost 14 GB in 7 days = 2 GB/day, 30 GB left -> 15 days
    const out = daysUntilFull([snap('2026-11-01T00:00:00Z', 44), snap('2026-11-08T00:00:00Z', 30)])
    expect(out).toBeCloseTo(15)
  })
  it('is null with under a day of data, one point, or growing free space', () => {
    expect(daysUntilFull([snap('2026-11-01T00:00:00Z', 44)])).toBeNull()
    expect(
      daysUntilFull([snap('2026-11-01T00:00:00Z', 44), snap('2026-11-01T06:00:00Z', 30)])
    ).toBeNull()
    expect(
      daysUntilFull([snap('2026-11-01T00:00:00Z', 30), snap('2026-11-08T00:00:00Z', 44)])
    ).toBeNull()
  })
})
