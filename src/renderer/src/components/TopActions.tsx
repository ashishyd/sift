import clsx from 'clsx'
import type { CategoryResult, RiskLevel } from '@shared/types'
import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'

const RISK_WEIGHT: Record<RiskLevel, number> = { safe: 1, caution: 0.6, review: 0.3 }

const RISK_DOT: Record<RiskLevel, string> = {
  safe: 'bg-[var(--sift-safe)]',
  caution: 'bg-[var(--sift-caution)]',
  review: 'bg-[var(--sift-review)]'
}

function rankCategories(categories: CategoryResult[]): CategoryResult[] {
  return categories
    .filter((c) => c.id !== 'trash' && !c.missing && c.totalSizeBytes > 0)
    .slice()
    .sort((a, b) => b.totalSizeBytes * RISK_WEIGHT[b.risk] - a.totalSizeBytes * RISK_WEIGHT[a.risk])
}

export default function TopActions(): React.JSX.Element | null {
  const summary = useSiftStore((s) => s.summary)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const trashPaths = useSiftStore((s) => s.trashPaths)
  const showToast = useSiftStore((s) => s.showToast)

  if (!summary) return null
  const ranked = rankCategories(summary.categories).slice(0, 5)
  if (ranked.length === 0) return null

  const safeCategories = summary.categories.filter(
    (c) => c.risk === 'safe' && !c.missing && c.totalSizeBytes > 0 && c.items.length > 0
  )
  const confidentTotal = safeCategories.reduce((s, c) => s + c.totalSizeBytes, 0)
  const safePaths = safeCategories.flatMap((c) => c.items.map((i) => i.path))
  const safeItemCount = safePaths.length

  const clearAllSafe = async (): Promise<void> => {
    if (safePaths.length === 0) return
    const labels = safeCategories
      .map((c) => `• ${c.label} — ${formatBytes(c.totalSizeBytes)} (${c.items.length} items)`)
      .join('\n')
    const confirmed = await window.api.confirmTrash(
      safeItemCount,
      `${formatBytes(confidentTotal)}\n\n${labels}`
    )
    if (!confirmed) return
    await trashPaths(safePaths, { skipConfirm: true })
  }

  return (
    <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--sift-border)] flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[15px]">Top actions</h2>
          <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
            Ranked by space freed and how confident Sift is it&apos;s safe.{' '}
            {confidentTotal > 0 && (
              <>
                Clearing everything marked <span className="text-[var(--sift-safe)]">safe</span> alone
                would free{' '}
                <span className="font-medium text-[var(--sift-text)]">
                  {formatBytes(confidentTotal)}
                </span>
                .
              </>
            )}
          </p>
        </div>
        {safeItemCount > 0 && (
          <button
            onClick={clearAllSafe}
            className="shrink-0 rounded-md bg-[var(--sift-safe)]/15 text-[var(--sift-safe)] px-2.5 py-1.5 text-[12px] font-medium hover:opacity-80"
            title={`Clear ${safeItemCount} safe items across ${safeCategories.length} categories`}
          >
            Clear all Safe
          </button>
        )}
      </div>
      <ul className="divide-y divide-[var(--sift-border)]">
        {ranked.map((c, idx) => {
          const paths = c.items.map((i) => i.path)
          const needsReview = c.risk === 'review'
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[12px] text-[var(--sift-text-muted)] tabular-nums w-4 shrink-0">
                {idx + 1}
              </span>
              <span className={clsx('size-2 rounded-full shrink-0', RISK_DOT[c.risk])} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{c.label}</div>
                <div className="text-[11.5px] text-[var(--sift-text-muted)] truncate">
                  {c.items.length} item(s) · {c.description}
                </div>
              </div>
              <span className="text-[13px] font-semibold tabular-nums shrink-0">
                {formatBytes(c.totalSizeBytes)}
              </span>
              {paths[0] && (
                <button
                  onClick={() => window.api.revealInFinder(paths[0])}
                  className="text-[12px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  title="Show the largest item in Finder"
                >
                  Open in Finder
                </button>
              )}
              {needsReview ? (
                <button
                  onClick={() => {
                    selectAllInCategory(paths)
                    showToast('Review items selected — check the list before clearing')
                  }}
                  className="rounded-md bg-[var(--sift-accent-soft)] text-[var(--sift-accent)] px-2.5 py-1 text-[12px] font-medium hover:opacity-80 shrink-0"
                  title="Review categories can't be cleared in one click — select them to inspect first"
                >
                  Review
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      selectAllInCategory(paths)
                    }}
                    className="text-[12px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => trashPaths(paths)}
                    className="rounded-md bg-[var(--sift-accent-soft)] text-[var(--sift-accent)] px-2.5 py-1 text-[12px] font-medium hover:opacity-80 shrink-0"
                  >
                    Clear
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
