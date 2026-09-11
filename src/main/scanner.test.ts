import { describe, expect, it } from 'vitest'
import { applyIgnoredPaths } from './scanner'
import type { CategoryResult, ScanItem } from '../shared/types'

function item(path: string, sizeBytes: number): ScanItem {
  return { path, name: path.split('/').pop()!, sizeBytes, isDirectory: false, lastAccessed: null, lastModified: null }
}

function category(id: string, items: ScanItem[]): CategoryResult {
  return {
    id,
    label: id,
    description: '',
    risk: 'safe',
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items,
    missing: false,
    permissionDenied: false
  }
}

describe('applyIgnoredPaths', () => {
  it('returns results unchanged when nothing is ignored', () => {
    const results = [category('a', [item('/a/1', 100)])]
    expect(applyIgnoredPaths(results, [])).toBe(results)
  })

  it('drops ignored items and recomputes the category total', () => {
    const results = [category('a', [item('/a/1', 100), item('/a/2', 50)])]
    const filtered = applyIgnoredPaths(results, ['/a/2'])
    expect(filtered[0].items.map((i) => i.path)).toEqual(['/a/1'])
    expect(filtered[0].totalSizeBytes).toBe(100)
  })

  it('leaves categories with no ignored items untouched', () => {
    const results = [category('a', [item('/a/1', 100)]), category('b', [item('/b/1', 20)])]
    const filtered = applyIgnoredPaths(results, ['/a/1'])
    expect(filtered[1].items).toHaveLength(1)
    expect(filtered[1].totalSizeBytes).toBe(20)
  })
})
