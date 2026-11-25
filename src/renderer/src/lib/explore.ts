import type { CategoryResult } from '@shared/types'

export type ExploreFilter = 'all' | 'clearable' | 'untouched'

export const UNTOUCHED_DAYS = 90

/** Newest lastModified ISO string among listed items, or null when none has a date. */
export function newestModified(category: CategoryResult): string | null {
  let newest: string | null = null
  for (const i of category.items) {
    if (i.lastModified && (!newest || i.lastModified > newest)) newest = i.lastModified
  }
  return newest
}

export function matchesExploreFilter(
  category: CategoryResult,
  filter: ExploreFilter,
  now: number = Date.now()
): boolean {
  if (filter === 'all') return true
  if (filter === 'clearable') return category.risk !== 'review'
  // The list is capped and newest-item is a weak signal, so a capped category is never "untouched".
  if ((category.matchedItemCount ?? category.items.length) > category.items.length) return false
  const newest = newestModified(category)
  // An unknown date is not proof the category is untouched, so it is excluded.
  return newest !== null && now - new Date(newest).getTime() > UNTOUCHED_DAYS * 86_400_000
}
