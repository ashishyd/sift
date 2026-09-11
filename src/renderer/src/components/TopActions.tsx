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
    .filter((c) => !c.missing && c.totalSizeBytes > 0)
    .slice()
    .sort((a, b) => b.totalSizeBytes * RISK_WEIGHT[b.risk] - a.totalSizeBytes * RISK_WEIGHT[a.risk])
}

export default function TopActions(): React.JSX.Element | null {
  const summary = useSiftStore((s) => s.summary)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const trashPaths = useSiftStore((s) => s.trashPaths)

  if (!summary) return null
  const ranked = rankCategories(summary.categories).slice(0, 6)
  if (ranked.length === 0) return null

  const confidentTotal = summary.categories
    .filter((c) => c.risk === 'safe' && !c.missing)
    .reduce((s, c) => s + c.totalSizeBytes, 0)

  return (
    <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--sift-border)]">
        <h2 className="font-semibold text-[15px]">Top actions</h2>
        <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
          Ranked by space freed and how confident Sift is it&apos;s safe.{' '}
          {confidentTotal > 0 && (
            <>
              Clearing everything marked <span className="text-[var(--sift-safe)]">safe</span> alone would free{' '}
              <span className="font-medium text-[var(--sift-text)]">{formatBytes(confidentTotal)}</span>.
            </>
          )}
        </p>
      </div>
      <ul className="divide-y divide-[var(--sift-border)]">
        {ranked.map((c, idx) => {
          const paths = c.items.map((i) => i.path)
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[12px] text-[var(--sift-text-muted)] tabular-nums w-4 shrink-0">{idx + 1}</span>
              <span className={clsx('size-2 rounded-full shrink-0', RISK_DOT[c.risk])} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{c.label}</div>
                <div className="text-[11.5px] text-[var(--sift-text-muted)] truncate">
                  {c.items.length} item(s) · {c.description}
                </div>
              </div>
              <span className="text-[13px] font-semibold tabular-nums shrink-0">{formatBytes(c.totalSizeBytes)}</span>
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
