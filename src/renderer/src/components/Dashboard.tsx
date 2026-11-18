import { useSiftStore } from '../store'
import { formatBytes } from '../lib/format'
import DiskLedger from './DiskLedger'
import GrowthCard from './GrowthCard'
import CategoryCard from './CategoryCard'
import VolumesList from './VolumesList'
import AiPanel from './AiPanel'
import PermissionsBanner from './PermissionsBanner'

export default function Dashboard(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const isScanning = useSiftStore((s) => s.isScanning)
  const progress = useSiftStore((s) => s.progress)
  const scanLog = useSiftStore((s) => s.scanLog)
  const runScan = useSiftStore((s) => s.runScan)
  const cancelScan = useSiftStore((s) => s.cancelScan)
  const selected = useSiftStore((s) => s.selected)
  const trashSelected = useSiftStore((s) => s.trashSelected)
  const clearSelected = useSiftStore((s) => s.clearSelected)

  if (!summary && !isScanning) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-[560px] flex-col justify-center gap-5">
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
            See what&apos;s safe to clear before you clear it.
          </h1>
          <p className="text-[13px] leading-relaxed text-[var(--sift-text-muted)]">
            Sift measures caches, build files, old downloads and duplicates, then ranks each by how
            safe it is to remove.
          </p>
        </div>
        <ul className="divide-y divide-[var(--sift-border)] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]">
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">Everything goes to the Trash first</div>
            <div className="text-[12.5px] text-[var(--sift-text-muted)]">
              Recoverable until you empty it yourself.
            </div>
          </li>
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">Every item has a risk level</div>
            <div className="flex gap-2.5 text-[12.5px]">
              <span className="text-[var(--sift-safe)]">Safe</span>
              <span className="text-[var(--sift-caution)]">Caution</span>
              <span className="text-[var(--sift-review)]">Review</span>
            </div>
          </li>
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">macOS may ask for folder access</div>
            <div className="text-[12.5px] text-[var(--sift-text-muted)]">
              Downloads, Desktop and Documents. Say no and Sift skips them, and tells you.
            </div>
          </li>
        </ul>
        <div>
          <button
            onClick={runScan}
            className="rounded-lg bg-[var(--sift-accent)] px-5 py-3 text-[13.5px] font-medium text-black hover:opacity-90"
          >
            Scan my Mac
          </button>
        </div>
      </section>
    )
  }

  if (isScanning) {
    return (
      <section
        aria-labelledby="scan-h"
        className="max-w-[720px] space-y-4 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="scan-h" className="text-[15px] font-semibold">
              Scanning your Mac
            </h2>
            <p className="text-[12.5px] text-[var(--sift-text-muted)]">
              Reading sizes only. Nothing is moved until you choose.
            </p>
          </div>
          {progress && (
            <span className="text-[13px] tabular-nums text-[var(--sift-text-muted)]">
              {progress.done} of {progress.total} places
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Scan progress"
          aria-valuemin={0}
          aria-valuemax={progress?.total ?? 0}
          aria-valuenow={progress?.done ?? 0}
          className="h-1.5 overflow-hidden rounded-full bg-[#1e222c]"
        >
          <div
            className="h-1.5 bg-[var(--sift-accent)]"
            style={{
              width:
                progress && progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%'
            }}
          />
        </div>
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {[...scanLog, ...(progress ? [progress.label] : [])].map((label, idx) => {
            const isDone = idx < scanLog.length
            return (
              <li
                key={`${label}-${idx}`}
                className={
                  'flex items-center gap-2 border-b border-[var(--sift-border)] py-2 text-[12.5px] ' +
                  (isDone ? 'text-[var(--sift-text-muted)]' : 'font-medium text-[var(--sift-text)]')
                }
              >
                <span
                  className={
                    'w-3.5 text-center ' +
                    (isDone ? 'text-[var(--sift-safe)]' : 'text-[var(--sift-accent)]')
                  }
                >
                  {isDone ? '✓' : '›'}
                </span>
                {label}
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end">
          <button
            onClick={cancelScan}
            className="rounded-lg border border-[var(--sift-border)] px-3.5 py-2 text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
          >
            Cancel scan
          </button>
        </div>
      </section>
    )
  }

  if (!summary) return <></>

  const visibleCategories = summary.categories.filter((c) => !c.missing && c.items.length > 0)
  const sizeMap = new Map<string, number>()
  summary.categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
  const selectedBytes = Array.from(selected).reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[16px] font-semibold">Overview</h1>
        <div className="flex items-center gap-3 text-[12.5px] text-[var(--sift-text-muted)]">
          <span>Scanned {new Date(summary.scannedAt).toLocaleString()}</span>
          <button
            onClick={runScan}
            className="rounded-lg border border-[var(--sift-border)] px-3 py-1.5 text-[var(--sift-text)] hover:bg-white/5"
          >
            Rescan
          </button>
        </div>
      </header>

      <DiskLedger />
      <GrowthCard />
      <PermissionsBanner />

      <div className="flex flex-wrap items-start gap-4">
        <section className="min-w-0 flex-[999_1_480px] space-y-3">
          <h2 className="text-[15px] font-semibold">Categories</h2>
          {visibleCategories.length === 0 && (
            <p className="text-[13px] text-[var(--sift-text-muted)]">
              Nothing found in the places Sift checks — your Mac looks clean.
            </p>
          )}
          {visibleCategories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </section>

        <aside className="min-w-0 flex-[1_1_260px] space-y-4">
          <AiPanel />
          <VolumesList volumes={summary.volumes ?? []} />
        </aside>
      </div>

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Selection"
          className="sticky bottom-0 -mx-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sift-border)] bg-[var(--sift-surface)]/95 px-8 py-3 backdrop-blur"
        >
          <span className="text-[13px]">
            <strong className="font-semibold tabular-nums">
              {selected.size} item(s) · {formatBytes(selectedBytes)}
            </strong>
            <span className="text-[var(--sift-text-muted)]">
              {' '}
              selected · moves to Trash, recoverable
            </span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={clearSelected}
              className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--sift-text-muted)] hover:bg-white/5"
            >
              Deselect
            </button>
            <button
              onClick={trashSelected}
              className="rounded-lg bg-[var(--sift-review)] px-4 py-2 text-[12.5px] font-medium text-black"
            >
              Move to Trash
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
