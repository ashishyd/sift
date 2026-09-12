import { useSiftStore } from '../store'
import { formatBytes } from '../lib/format'
import StorageGauge from './StorageGauge'
import CategoryCard from './CategoryCard'
import AiPanel from './AiPanel'
import TopActions from './TopActions'
import PermissionsBanner from './PermissionsBanner'
import appIcon from '../assets/app-icon.png'

export default function Dashboard(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const isScanning = useSiftStore((s) => s.isScanning)
  const progress = useSiftStore((s) => s.progress)
  const scanLog = useSiftStore((s) => s.scanLog)
  const runScan = useSiftStore((s) => s.runScan)
  const selected = useSiftStore((s) => s.selected)
  const trashSelected = useSiftStore((s) => s.trashSelected)
  const clearSelected = useSiftStore((s) => s.clearSelected)

  if (!summary && !isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-4">
        <img src={appIcon} alt="" className="size-16 rounded-[14px]" />
        <div>
          <h2 className="font-semibold text-[18px]">Ready when you are</h2>
          <p className="text-[13px] text-[var(--sift-text-muted)] mt-1 max-w-sm leading-relaxed">
            Sift checks caches, dev-tool build files, old downloads and duplicates, then ranks
            what&apos;s safe to clear. Nothing leaves your Mac permanently — everything goes to the
            Trash first, so you can always get it back.
          </p>
        </div>
        <button
          onClick={runScan}
          className="rounded-lg bg-[var(--sift-accent)] px-5 py-2.5 text-[13.5px] font-medium text-black hover:opacity-90"
        >
          Scan my Mac
        </button>
      </div>
    )
  }

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-5">
        <div className="size-8 border-2 border-[var(--sift-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13.5px] text-[var(--sift-text-muted)]">
          {progress
            ? `Scanning ${progress.label}… (${progress.done}/${progress.total})`
            : 'Starting scan…'}
        </p>
        {progress && (progress.done > 0 || scanLog.length > 0) && (
          <ul className="flex flex-col gap-1.5 w-[280px]">
            {[...scanLog, progress.label].map((label, idx) => {
              const isDone = idx < scanLog.length
              return (
                <li
                  key={`${label}-${idx}`}
                  className={
                    'flex items-center gap-2 text-[12.5px] ' +
                    (isDone ? 'text-[var(--sift-safe)]' : 'text-[var(--sift-text)]')
                  }
                >
                  <span className="w-3.5 text-center">{isDone ? '✓' : '›'}</span>
                  {label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  if (!summary) return <></>

  const visibleCategories = summary.categories.filter((c) => !c.missing && c.items.length > 0)
  const sizeMap = new Map<string, number>()
  summary.categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
  const selectedBytes = Array.from(selected).reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--sift-text-muted)]">
        Clearing anything below moves it to the Trash — nothing is deleted until you empty it
        yourself.
      </p>

      <PermissionsBanner />
      <TopActions />

      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-[16px]">Categories</h2>
            <button
              onClick={runScan}
              className="text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
            >
              Rescan
            </button>
          </div>
          {visibleCategories.length === 0 && (
            <p className="text-[13px] text-[var(--sift-text-muted)]">
              Nothing found in the places Sift checks — your Mac looks clean.
            </p>
          )}
          {visibleCategories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-4 flex flex-col items-center">
            <StorageGauge
              totalBytes={summary.volumeTotalBytes}
              freeBytes={summary.volumeFreeBytes}
              reclaimableBytes={summary.reclaimableBytes}
            />
            <div className="w-full mt-3 space-y-1 text-[12px] text-[var(--sift-text-muted)]">
              <div className="flex justify-between">
                <span>Disk total</span>
                <span>{formatBytes(summary.volumeTotalBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Free now</span>
                <span>{formatBytes(summary.volumeFreeBytes)}</span>
              </div>
            </div>
          </div>

          <AiPanel />

          {selected.size > 0 && (
            <div className="rounded-xl border border-[var(--sift-review)]/30 bg-[var(--sift-review)]/10 p-3.5 space-y-2">
              <p className="text-[13px]">
                {selected.size} item(s) · {formatBytes(selectedBytes)} selected · moves to Trash,
                recoverable
              </p>
              <div className="flex gap-2">
                <button
                  onClick={trashSelected}
                  className="flex-1 rounded-lg bg-[var(--sift-review)] px-3 py-1.5 text-[12.5px] font-medium text-black"
                >
                  Move to Trash
                </button>
                <button
                  onClick={clearSelected}
                  className="rounded-lg px-3 py-1.5 text-[12.5px] text-[var(--sift-text-muted)] hover:bg-white/5"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
