import type { CategoryResult, ScanPreferences } from './types'

export const DEFAULT_SCAN_PREFERENCES: ScanPreferences = {
  largeFileMinMb: 200,
  largeFileMinAgeDays: 180,
  downloadsMinAgeDays: 90,
  logsMinAgeDays: 30,
  messagesMinAgeDays: 180,
  mailMinAgeDays: 30,
  archivesMinAgeDays: 90,
  backgroundScanHours: 4,
  disabledCategoryIds: []
}

export function normalizeScanPreferences(
  partial?: Partial<ScanPreferences> | null
): ScanPreferences {
  const merged = { ...DEFAULT_SCAN_PREFERENCES, ...(partial ?? {}) }
  return {
    largeFileMinMb: clampInt(merged.largeFileMinMb, 50, 5000, DEFAULT_SCAN_PREFERENCES.largeFileMinMb),
    largeFileMinAgeDays: clampInt(
      merged.largeFileMinAgeDays,
      7,
      3650,
      DEFAULT_SCAN_PREFERENCES.largeFileMinAgeDays
    ),
    downloadsMinAgeDays: clampInt(
      merged.downloadsMinAgeDays,
      7,
      3650,
      DEFAULT_SCAN_PREFERENCES.downloadsMinAgeDays
    ),
    logsMinAgeDays: clampInt(merged.logsMinAgeDays, 1, 3650, DEFAULT_SCAN_PREFERENCES.logsMinAgeDays),
    messagesMinAgeDays: clampInt(
      merged.messagesMinAgeDays,
      7,
      3650,
      DEFAULT_SCAN_PREFERENCES.messagesMinAgeDays
    ),
    mailMinAgeDays: clampInt(merged.mailMinAgeDays, 1, 3650, DEFAULT_SCAN_PREFERENCES.mailMinAgeDays),
    archivesMinAgeDays: clampInt(
      merged.archivesMinAgeDays,
      7,
      3650,
      DEFAULT_SCAN_PREFERENCES.archivesMinAgeDays
    ),
    backgroundScanHours: clampInt(
      merged.backgroundScanHours,
      1,
      168,
      DEFAULT_SCAN_PREFERENCES.backgroundScanHours
    ),
    disabledCategoryIds: Array.isArray(merged.disabledCategoryIds)
      ? [...new Set(merged.disabledCategoryIds.filter((id) => typeof id === 'string'))]
      : []
  }
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Bytes/count not shown in the capped item list. */
export function categoryHiddenStats(category: CategoryResult): { count: number; bytes: number } {
  const matched = category.matchedItemCount ?? category.items.length
  const listedBytes = category.items.reduce((s, i) => s + i.sizeBytes, 0)
  return {
    count: Math.max(0, matched - category.items.length),
    bytes: Math.max(0, category.totalSizeBytes - listedBytes)
  }
}
