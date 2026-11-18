import type { ScanSnapshot, ScanSummary } from './types'

const MAX_SNAPSHOTS = 90
const MIN_GAP_MS = 60 * 60 * 1000
const DAY_MS = 86_400_000

/** Missing and permission-denied categories are left out: their 0 would read as "shrank". */
export function snapshotOf(summary: ScanSummary): ScanSnapshot {
  const categories: Record<string, number> = {}
  for (const c of summary.categories) {
    if (!c.missing && !c.permissionDenied) categories[c.id] = c.totalSizeBytes
  }
  return {
    at: summary.scannedAt,
    totalBytes: summary.volumeTotalBytes,
    freeBytes: summary.volumeFreeBytes,
    categories
  }
}

/** Newest last. A scan within an hour of the previous one replaces it instead of adding a point. */
export function appendSnapshot(list: ScanSnapshot[], snap: ScanSnapshot): ScanSnapshot[] {
  const last = list[list.length - 1]
  const base =
    last && new Date(snap.at).getTime() - new Date(last.at).getTime() < MIN_GAP_MS
      ? list.slice(0, -1)
      : list
  return [...base, snap].slice(-MAX_SNAPSHOTS)
}

export interface CategoryGrowth {
  id: string
  deltaBytes: number
}

/** Categories present in both snapshots, biggest growth first, shrinkage last. */
export function categoryGrowth(prev: ScanSnapshot, curr: ScanSnapshot): CategoryGrowth[] {
  return Object.keys(curr.categories)
    .filter((id) => id in prev.categories && curr.categories[id] !== prev.categories[id])
    .map((id) => ({ id, deltaBytes: curr.categories[id] - prev.categories[id] }))
    .sort((a, b) => b.deltaBytes - a.deltaBytes)
}

/** Linear estimate from oldest to newest free space. Null if under a day of data or not shrinking. */
export function daysUntilFull(list: ScanSnapshot[]): number | null {
  if (list.length < 2) return null
  const first = list[0]
  const last = list[list.length - 1]
  const days = (new Date(last.at).getTime() - new Date(first.at).getTime()) / DAY_MS
  const lostPerDay = (first.freeBytes - last.freeBytes) / days
  if (days < 1 || !(lostPerDay > 0)) return null
  return last.freeBytes / lostPerDay
}
