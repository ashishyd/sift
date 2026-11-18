import { useSiftStore } from '../store'
import { formatBytes } from '../lib/format'
import { riskTotals } from '@shared/reclaimable'

const SEGMENTS = [
  { risk: 'safe', label: 'Safe', note: 'Rebuilt on demand', color: 'var(--sift-safe)' },
  { risk: 'caution', label: 'Caution', note: 'Slower next launch', color: 'var(--sift-caution)' },
  { risk: 'review', label: 'Review', note: 'Might be yours', color: 'var(--sift-review)' }
] as const

export default function DiskLedger(): React.JSX.Element | null {
  const summary = useSiftStore((s) => s.summary)
  const trashPaths = useSiftStore((s) => s.trashPaths)

  if (!summary) return null

  const totals = riskTotals(summary.categories)
  const trash = summary.categories.find((c) => c.id === 'trash')
  const used = Math.max(summary.volumeTotalBytes - summary.volumeFreeBytes, 0)
  const otherUsed = Math.max(used - summary.reclaimableBytes, 0)

  const safeCategories = summary.categories.filter(
    (c) => c.risk === 'safe' && !c.missing && c.totalSizeBytes > 0 && c.items.length > 0
  )
  const safeTotal = safeCategories.reduce((s, c) => s + c.totalSizeBytes, 0)
  const safePaths = safeCategories.flatMap((c) => c.items.map((i) => i.path))

  const clearAllSafe = async (): Promise<void> => {
    if (safePaths.length === 0) return
    const labels = safeCategories
      .map((c) => `• ${c.label} — ${formatBytes(c.totalSizeBytes)} (${c.items.length} items)`)
      .join('\n')
    const confirmed = await window.api.confirmTrash(
      safePaths.length,
      `${formatBytes(safeTotal)}\n\n${labels}`
    )
    if (!confirmed) return
    await trashPaths(safePaths, { skipConfirm: true })
  }

  return (
    <section
      aria-labelledby="ledger-h"
      className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 id="ledger-h" className="text-[12.5px] text-[var(--sift-text-muted)]">
            Reclaimable on your startup disk
          </h2>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[32px] font-semibold tracking-tight tabular-nums">
              {formatBytes(summary.reclaimableBytes)}
            </span>
            <span className="text-[13px] text-[var(--sift-text-muted)] tabular-nums">
              of {formatBytes(summary.volumeTotalBytes)} · {formatBytes(summary.volumeFreeBytes)}{' '}
              free now
            </span>
          </div>
        </div>
        {safeTotal > 0 && (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={clearAllSafe}
              className="rounded-lg bg-[var(--sift-accent)] px-4 py-2.5 text-[13.5px] font-medium text-black hover:opacity-90"
            >
              Clear {formatBytes(safeTotal)} marked safe…
            </button>
            <span className="text-[11.5px] text-[var(--sift-text-muted)]">
              Moves to Trash. Recoverable until you empty it.
            </span>
          </div>
        )}
      </div>

      <div
        role="img"
        aria-label={`Disk: ${formatBytes(otherUsed)} other used, ${formatBytes(totals.safe)} safe, ${formatBytes(totals.caution)} caution, ${formatBytes(totals.review)} review, ${formatBytes(summary.volumeFreeBytes)} free`}
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#1e222c]"
      >
        <div style={{ flex: `${otherUsed} 1 0`, background: '#3a4152' }} />
        {SEGMENTS.map((s) => (
          <div key={s.risk} style={{ flex: `${totals[s.risk]} 1 0`, background: s.color }} />
        ))}
        <div style={{ flex: `${summary.volumeFreeBytes} 1 0` }} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEGMENTS.map((s) => (
          <div key={s.risk} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--sift-text-muted)]">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="text-[15px] font-semibold tabular-nums">
              {formatBytes(totals[s.risk])}
            </span>
            <span className="text-[11.5px] text-[var(--sift-text-muted)]">{s.note}</span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--sift-text-muted)]">
            <span className="size-2 rounded-sm bg-[#3a4152]" />
            Trash
          </span>
          <span className="text-[15px] font-semibold tabular-nums">
            {formatBytes(trash?.totalSizeBytes ?? 0)}
          </span>
          <span className="text-[11.5px] text-[var(--sift-text-muted)]">Not counted above</span>
        </div>
      </div>
    </section>
  )
}
