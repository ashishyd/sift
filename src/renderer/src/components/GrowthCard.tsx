import { useSiftStore } from '../store'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { categoryGrowth, daysUntilFull } from '@shared/growth'

export default function GrowthCard(): React.JSX.Element | null {
  const summary = useSiftStore((s) => s.summary)
  const history = useSiftStore((s) => s.scanHistory)

  if (!summary || !history) return null

  const cardClass =
    'rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5 space-y-3'

  if (history.length < 2) {
    return (
      <section aria-labelledby="growth-h" className={cardClass}>
        <h2 id="growth-h" className="text-[15px] font-semibold">
          What grew
        </h2>
        <p className="text-[12.5px] text-[var(--sift-text-muted)]">
          Sift compares scans over time. Scan again later to see what changed.
        </p>
      </section>
    )
  }

  const prev = history[history.length - 2]
  const curr = history[history.length - 1]
  const labels = new Map(summary.categories.map((c) => [c.id, c.label]))
  const growers = categoryGrowth(prev, curr)
    .filter((g) => g.deltaBytes > 0)
    .slice(0, 5)
  const freeDelta = curr.freeBytes - prev.freeBytes
  const days = daysUntilFull(history)
  const anyDenied = summary.categories.some((c) => c.permissionDenied)

  return (
    <section aria-labelledby="growth-h" className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="growth-h" className="text-[15px] font-semibold">
          What grew
        </h2>
        <span className="text-[12.5px] text-[var(--sift-text-muted)] tabular-nums">
          since {formatRelativeDate(prev.at)} · free space {freeDelta < 0 ? '−' : '+'}
          {formatBytes(Math.abs(freeDelta))}
        </span>
      </div>

      {growers.length === 0 ? (
        <p className="text-[12.5px] text-[var(--sift-text-muted)]">
          No scanned category grew since the previous scan.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--sift-border)]">
          {growers.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <span className="truncate" title={labels.get(g.id) ?? g.id}>
                {labels.get(g.id) ?? g.id}
              </span>
              <span className="tabular-nums text-[var(--sift-text-muted)]">
                +{formatBytes(g.deltaBytes)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {days !== null && (
        <p className="text-[12.5px] text-[var(--sift-text-muted)]">
          At this pace the disk is full in{' '}
          {days > 365 ? 'more than a year' : `about ${Math.max(1, Math.round(days))} day(s)`}. This
          is an estimate from free space across your scans.
        </p>
      )}
      {anyDenied && (
        <p className="text-[11.5px] text-[var(--sift-text-muted)]">
          Categories macOS refused to read are left out of this comparison.
        </p>
      )}
    </section>
  )
}
