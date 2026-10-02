import { describe, expect, it } from 'vitest'
import { applyIgnoredPaths, parseDfOutput } from './scanner'
import {
  computeReclaimableBytes,
  dedupeOverlappingCategoryPaths,
  USER_CACHES_DEDICATED_NAMES
} from '../shared/reclaimable'
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

function category(
  id: string,
  items: ScanItem[],
  opts: Partial<CategoryResult> = {}
): CategoryResult {
  return {
    id,
    label: id,
    description: '',
    risk: 'safe',
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items,
    matchedItemCount: items.length,
    missing: false,
    permissionDenied: false,
    ...opts
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
    expect(filtered[0].matchedItemCount).toBe(1)
  })

  it('leaves categories with no ignored items untouched', () => {
    const results = [category('a', [item('/a/1', 100)]), category('b', [item('/b/1', 20)])]
    const filtered = applyIgnoredPaths(results, ['/a/1'])
    expect(filtered[1].items).toHaveLength(1)
    expect(filtered[1].totalSizeBytes).toBe(20)
  })
})

describe('dedupeOverlappingCategoryPaths', () => {
  it('removes Downloads paths from large-files when already in downloads-old', () => {
    const shared = item('/Users/x/Downloads/old-iso.dmg', 500)
    const results = dedupeOverlappingCategoryPaths([
      category('downloads-old', [shared, item('/Users/x/Downloads/notes.txt', 10)]),
      category('large-files', [shared, item('/Users/x/Desktop/big.mov', 800)])
    ])
    const large = results.find((c) => c.id === 'large-files')!
    expect(large.items.map((i) => i.path)).toEqual(['/Users/x/Desktop/big.mov'])
    expect(large.totalSizeBytes).toBe(800)
  })

  it('prefers orphaned-dmgs over downloads-old and large-files', () => {
    const dmg = item('/Users/x/Downloads/Installer.dmg', 900)
    const results = dedupeOverlappingCategoryPaths([
      category('orphaned-dmgs', [dmg]),
      category('downloads-old', [dmg, item('/Users/x/Downloads/notes.txt', 10)]),
      category('large-files', [dmg])
    ])
    expect(results.find((c) => c.id === 'downloads-old')!.items.map((i) => i.path)).toEqual([
      '/Users/x/Downloads/notes.txt'
    ])
    expect(results.find((c) => c.id === 'large-files')!.items).toHaveLength(0)
    expect(results.find((c) => c.id === 'orphaned-dmgs')!.items).toHaveLength(1)
  })

  it('leaves categories alone when there is no overlap', () => {
    const results = dedupeOverlappingCategoryPaths([
      category('downloads-old', [item('/Users/x/Downloads/a', 10)]),
      category('large-files', [item('/Users/x/Desktop/b', 20)])
    ])
    expect(results.find((c) => c.id === 'large-files')!.totalSizeBytes).toBe(20)
  })
})

describe('computeReclaimableBytes', () => {
  it('excludes trash', () => {
    const bytes = computeReclaimableBytes([
      category('user-caches', [item('/c/1', 100)]),
      category('trash', [item('/.Trash/x', 999)])
    ])
    expect(bytes).toBe(100)
  })

  it('does not double-count the same path across categories', () => {
    const shared = item('/Users/x/Downloads/big.dmg', 500)
    const bytes = computeReclaimableBytes([
      category('downloads-old', [shared]),
      category('large-files', [shared, item('/Users/x/Desktop/other.bin', 100)])
    ])
    expect(bytes).toBe(600)
  })

  it('includes uncapped remainder beyond listed items', () => {
    const listed = [item('/a/1', 100)]
    const bytes = computeReclaimableBytes([
      category('user-caches', listed, { totalSizeBytes: 350 })
    ])
    expect(bytes).toBe(350)
  })
})

describe('USER_CACHES_DEDICATED_NAMES', () => {
  it('covers browser and package-manager cache folders under Library/Caches', () => {
    expect(USER_CACHES_DEDICATED_NAMES.has('Homebrew')).toBe(true)
    expect(USER_CACHES_DEDICATED_NAMES.has('Google')).toBe(true)
    expect(USER_CACHES_DEDICATED_NAMES.has('CocoaPods')).toBe(true)
    expect(USER_CACHES_DEDICATED_NAMES.has('pip')).toBe(true)
  })
})

describe('parseDfOutput', () => {
  it('keeps root and /Volumes mounts, drops pseudo filesystems', () => {
    const stdout = `
Filesystem     1024-blocks      Used Available Capacity  iused      ifree %iused  Mounted on
/dev/disk3s1s1   488245288  15234568  412000000    4%  500000  2000000000    0%   /
devfs                  201       201         0  100%     697           0  100%   /dev
/dev/disk3s5     488245288  50000000  412000000   11%  100000  2000000000    0%   /System/Volumes/Data
/dev/disk4s1      25000000   5000000  20000000   20%   10000   100000000    0%   /Volumes/Backup
map auto_home            0         0         0   100%       0           0  100%   /System/Volumes/Data/home
`
    const volumes = parseDfOutput(stdout)
    expect(volumes.map((v) => v.mountPoint)).toEqual(['/', '/Volumes/Backup'])
    expect(volumes[0].totalBytes).toBe(488245288 * 1024)
    expect(volumes[1].freeBytes).toBe(20000000 * 1024)
  })
})
