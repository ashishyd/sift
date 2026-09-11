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
  const runScan = useSiftStore((s) => s.runScan)
  const selected = useSiftStore((s) => s.selected)
  const trashSelected = useSiftStore((s) => s.trashSelected)
  const clearSelected = useSiftStore((s) => s.clearSelected)

  if (!summary && !isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-4">
        <img src={appIcon} alt="" className="size-16 rounded-[14px]" />
        <div>
          <h2 className="font-semibold text-[18px]">Ready to sift through your disk</h2>
          <p className="text-[13px] text-[var(--sift-text-muted)] mt-1 max-w-sm">
            Sift checks known cache and dev-tool locations, old downloads, and large unused files — nothing is
            deleted without your say-so.
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
      <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-3">
        <div className="size-8 border-2 border-[var(--sift-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13.5px] text-[var(--sift-text-muted)]">
          {progress ? `Scanning ${progress.label}… (${progress.done}/${progress.total})` : 'Starting scan…'}
        </p>
      </div>
    )
  }

  if (!summary) return <></>

  const visibleCategories = summary.categories.filter((c) => !c.missing && c.items.length > 0)

  return (
    <div className="space-y-4">
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
              Nothing found in the categories Sift checks — your Mac looks clean.
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
              <p className="text-[13px]">{selected.size} item(s) selected</p>
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
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
