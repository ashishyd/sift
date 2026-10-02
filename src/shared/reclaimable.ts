import type { CategoryResult } from './types'

/**
 * Sum reclaimable space across categories, excluding Trash (already deleted) and
 * never double-counting the same path if it appears in more than one category.
 *
 * Uses listed items for path identity; when a category's totalSizeBytes exceeds
 * the sum of its listed items (200-item cap), the uncapped remainder is added
 * once per category after unique listed paths are accounted for.
 */
export function computeReclaimableBytes(categories: CategoryResult[]): number {
  const seen = new Set<string>()
  let total = 0

  for (const c of categories) {
    if (c.id === 'trash') continue

    let listedSum = 0
    for (const item of c.items) {
      listedSum += item.sizeBytes
      if (seen.has(item.path)) continue
      seen.add(item.path)
      total += item.sizeBytes
    }

    // Uncapped remainder (items beyond the UI list) can't be path-deduped;
    // add it once so totals stay honest when the list is truncated.
    const remainder = c.totalSizeBytes - listedSum
    if (remainder > 0) total += remainder
  }

  return total
}

/**
 * Cache children under ~/Library/Caches that have their own dedicated category.
 * Scanning them again under App Caches would double-count reclaimable space.
 */
export const USER_CACHES_DEDICATED_NAMES = new Set([
  'Homebrew',
  'Yarn',
  'Google',
  'Firefox',
  'com.apple.Safari',
  'CloudKit',
  'com.microsoft.edgemac',
  'company.thebrowser.Browser',
  'BraveSoftware',
  'CocoaPods',
  'pip'
])

/**
 * Category pairs that can report the same path. Prefer the more specific
 * category (first) and strip duplicates from the secondary (second).
 */
export const PATH_OVERLAP_PREFERENCE: Array<[string, string]> = [
  // Old Downloads is the clearer label for a Downloads file; Large Files is broader.
  ['downloads-old', 'large-files'],
  // Old Disk Images are more specific than both Old Downloads and Large Files.
  ['orphaned-dmgs', 'downloads-old'],
  ['orphaned-dmgs', 'large-files']
]

/** Remove paths from secondary categories that already appear in a preferred category. */
export function dedupeOverlappingCategoryPaths(results: CategoryResult[]): CategoryResult[] {
  const byId = new Map(results.map((c) => [c.id, c]))

  for (const [preferredId, secondaryId] of PATH_OVERLAP_PREFERENCE) {
    const preferred = byId.get(preferredId)
    const secondary = byId.get(secondaryId)
    if (!preferred || !secondary) continue

    const preferredPaths = new Set(preferred.items.map((i) => i.path))
    if (preferredPaths.size === 0) continue

    const items = secondary.items.filter((i) => !preferredPaths.has(i.path))
    const removedBytes = secondary.items
      .filter((i) => preferredPaths.has(i.path))
      .reduce((s, i) => s + i.sizeBytes, 0)

    const removedCount = secondary.items.length - items.length
    const next: CategoryResult = {
      ...secondary,
      items,
      totalSizeBytes: Math.max(0, secondary.totalSizeBytes - removedBytes),
      matchedItemCount: Math.max(0, (secondary.matchedItemCount ?? secondary.items.length) - removedCount),
      missing: items.length === 0 && secondary.missing
    }
    byId.set(secondaryId, next)
  }

  return results.map((c) => byId.get(c.id) ?? c)
}
