import { describe, expect, it } from 'vitest'
import type { CategoryResult } from '../../../shared/types'
import { matchesExploreFilter, newestModified } from './explore'

const NOW = Date.parse('2026-06-01T00:00:00Z')

function cat(
  risk: CategoryResult['risk'],
  dates: (string | null)[],
  matched: number = dates.length
): CategoryResult {
  return {
    id: 'x',
    label: 'X',
    description: '',
    risk,
    totalSizeBytes: 1,
    matchedItemCount: matched,
    missing: false,
    permissionDenied: false,
    items: dates.map((d, n) => ({
      path: `/p/${n}`,
      name: `${n}`,
      sizeBytes: 1,
      isDirectory: false,
      lastAccessed: null,
      lastModified: d
    }))
  }
}

describe('explore filters', () => {
  it('picks the newest date', () => {
    expect(
      newestModified(cat('safe', ['2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z', null]))
    ).toBe('2026-03-01T00:00:00Z')
    expect(newestModified(cat('safe', [null]))).toBeNull()
  })

  it('clearable hides review risk', () => {
    expect(matchesExploreFilter(cat('review', []), 'clearable', NOW)).toBe(false)
    expect(matchesExploreFilter(cat('caution', []), 'clearable', NOW)).toBe(true)
    expect(matchesExploreFilter(cat('review', []), 'all', NOW)).toBe(true)
  })

  it('untouched needs newest item older than 90 days', () => {
    expect(matchesExploreFilter(cat('safe', ['2026-01-01T00:00:00Z']), 'untouched', NOW)).toBe(true)
    expect(matchesExploreFilter(cat('safe', ['2026-05-20T00:00:00Z']), 'untouched', NOW)).toBe(
      false
    )
    expect(matchesExploreFilter(cat('safe', [null]), 'untouched', NOW)).toBe(false)
  })

  it('untouched is false when the list is capped', () => {
    expect(matchesExploreFilter(cat('safe', ['2026-01-01T00:00:00Z'], 500), 'untouched', NOW)).toBe(
      false
    )
  })
})
