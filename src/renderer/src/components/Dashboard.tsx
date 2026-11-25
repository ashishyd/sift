import { useState } from 'react'
import { useSiftStore } from '../store'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { riskTotals } from '@shared/reclaimable'
import type { RiskLevel } from '@shared/types'
import type { StepResult } from '@shared/scanProgress'
import RiskBadge from './RiskBadge'
import DiskLedger from './DiskLedger'
import GrowthCard from './GrowthCard'
import CategoryCard from './CategoryCard'
import VolumesList from './VolumesList'
import AiPanel from './AiPanel'
import PermissionsBanner from './PermissionsBanner'
import { bin, isMac } from '../lib/platform'

const GROUPS: { risk: RiskLevel; title: string; hint: string; color: string }[] = [
  {
    risk: 'safe',
    title: 'Comes back on its own',
    hint: 'Caches and build output. Apps rebuild them when needed.',
    color: 'text-[var(--sift-safe)]'
  },
  {
    risk: 'caution',
    title: 'Look before you clear',
    hint: 'Usually fine. Each one costs you a download or a rebuild.',
    color: 'text-[var(--sift-caution)]'
  },
  {
    risk: 'review',
    title: 'Your files. Sift only points.',
    hint: 'Nothing here is chosen for you. Open each one.',
    color: 'text-[var(--sift-review)]'
  }
]

const MIX: Record<RiskLevel, { bg: string; text: string; label: (n: number) => string }> = {
  safe: {
    bg: 'bg-[var(--sift-safe)]',
    text: 'text-[var(--sift-safe)]',
    label: (n) => (n === 1 ? 'rebuilds itself' : 'rebuild themselves')
  },
  caution: {
    bg: 'bg-[var(--sift-caution)]',
    text: 'text-[var(--sift-caution)]',
    label: () => 'to check'
  },
  review: {
    bg: 'bg-[var(--sift-review)]',
    text: 'text-[var(--sift-review)]',
    label: (n) => (n === 1 ? 'your file' : 'your files')
  }
}

const STEP_LABEL: Record<StepResult['state'], string> = {
  found: '',
  empty: 'Empty',
  missing: 'Not on this machine',
  denied: 'Not allowed'
}

function StepRow({ result }: { result: StepResult }): React.JSX.Element {
  const warn = result.state === 'denied' || result.partial
  return (
    <li className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px]">
      <span
        aria-hidden="true"
        className={
          'w-3.5 text-center ' +
          (warn ? 'text-[var(--sift-caution)]' : 'text-[var(--sift-text-muted)]')
        }
      >
        {warn ? '⚠' : result.state === 'found' ? '✓' : '–'}
      </span>
      <span
        className={
          'grow truncate ' + (result.state === 'found' ? '' : 'text-[var(--sift-text-muted)]')
        }
      >
        {result.label}
      </span>
      <span
        className={
          'tabular-nums ' + (warn ? 'text-[var(--sift-caution)]' : 'text-[var(--sift-text-muted)]')
        }
      >
        {result.state === 'found'
          ? `${formatBytes(result.sizeBytes)}${result.partial ? ' · partly read' : ''}`
          : STEP_LABEL[result.state]}
      </span>
    </li>
  )
}

/** formatRelativeDate is day-granular; a fresh scan needs minutes. */
function scanAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.floor(mins / 60)} h ago`
  return formatRelativeDate(iso)
}

export default function Dashboard(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const isScanning = useSiftStore((s) => s.isScanning)
  const progress = useSiftStore((s) => s.progress)
  const scanLog = useSiftStore((s) => s.scanLog)
  const openPrivacySettings = useSiftStore((s) => s.openPrivacySettings)
  const runScan = useSiftStore((s) => s.runScan)
  const cancelScan = useSiftStore((s) => s.cancelScan)
  const autoScanning = useSiftStore((s) => s.autoScanning)
  const pendingSummary = useSiftStore((s) => s.pendingSummary)
  const applyPendingSummary = useSiftStore((s) => s.applyPendingSummary)
  const selected = useSiftStore((s) => s.selected)
  const folderCache = useSiftStore((s) => s.folderCache)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const clearSelected = useSiftStore((s) => s.clearSelected)
  const toggleSelected = useSiftStore((s) => s.toggleSelected)
  const [openGroups, setOpenGroups] = useState<Set<RiskLevel>>(new Set())

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
            <div className="text-[13px] font-medium">Everything goes to the {bin} first</div>
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
    const denied = scanLog.filter((r) => r.state === 'denied' || r.partial)
    return (
      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="scan-h" className="min-w-0 flex-[3_1_420px] space-y-4">
          <div className="space-y-1">
            {progress && (
              <p className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                {progress.done} of {progress.total} categories read
              </p>
            )}
            <h1 id="scan-h" className="text-[32px] font-semibold leading-tight tracking-tight">
              Sifting your disk
            </h1>
            <p className="text-[13px] text-[var(--sift-text-muted)]">
              Reading sizes only. Nothing is moved until you choose.
            </p>
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
                  progress && progress.total > 0
                    ? `${(progress.done / progress.total) * 100}%`
                    : '0%'
              }}
            />
          </div>
          {denied.length > 0 && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--sift-caution)]/30 bg-[var(--sift-caution)]/10 px-3.5 py-2.5 text-[12.5px]"
            >
              <span>
                <span aria-hidden="true" className="text-[var(--sift-caution)]">
                  ⚠{' '}
                </span>
                {isMac ? 'macOS' : 'Windows'} refused access to{' '}
                {denied.map((r) => r.label).join(', ')}. This scan will be marked incomplete.
              </span>
              <button
                onClick={() => openPrivacySettings('files')}
                className="font-medium text-[var(--sift-caution)] hover:underline"
              >
                Open privacy settings
              </button>
            </div>
          )}
          <ul className="divide-y divide-[var(--sift-border)] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]">
            {scanLog.map((r, idx) => (
              <StepRow key={`${r.label}-${idx}`} result={r} />
            ))}
            {progress && (
              <li className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium">
                <span aria-hidden="true" className="w-3.5 text-center text-[var(--sift-accent)]">
                  ›
                </span>
                <span className="grow truncate">{progress.label}</span>
                <span className="text-[var(--sift-text-muted)]">Reading…</span>
              </li>
            )}
          </ul>
          <button
            onClick={cancelScan}
            className="px-1 py-2 text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
          >
            Cancel scan
          </button>
        </section>
        <aside
          aria-labelledby="wait-h"
          className="min-w-0 flex-[1_1_240px] space-y-3 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
        >
          <h2 id="wait-h" className="text-[15px] font-semibold">
            While you wait
          </h2>
          <ul className="space-y-2.5 text-[12.5px] leading-relaxed">
            <li>A scan only reads. Nothing moves until you press a button.</li>
            <li>Everything you clear goes to the {bin} first. You can put it back.</li>
            <li>Claude sees category names and sizes. Never paths or file contents.</li>
          </ul>
          <p className="text-[12px] text-[var(--sift-text-muted)]">
            You can close this window. Sift keeps scanning from the {isMac ? 'menu bar' : 'tray'}.
          </p>
        </aside>
      </div>
    )
  }

  if (!summary) return <></>

  const visibleCategories = summary.categories.filter((c) => !c.missing && c.items.length > 0)
  const sizeMap = new Map<string, number>()
  summary.categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
  Object.values(folderCache).forEach((l) =>
    l.entries.forEach((i) => {
      if (!sizeMap.has(i.path)) sizeMap.set(i.path, i.sizeBytes)
    })
  )
  const totals = riskTotals(summary.categories)
  const selectedBytes = Array.from(selected).reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)
  const pathRisk = new Map<string, RiskLevel>()
  summary.categories.forEach((c) => c.items.forEach((i) => pathRisk.set(i.path, c.risk)))
  const mix: Record<RiskLevel, { count: number; bytes: number }> = {
    safe: { count: 0, bytes: 0 },
    caution: { count: 0, bytes: 0 },
    review: { count: 0, bytes: 0 }
  }
  selected.forEach((p) => {
    // Paths picked in Explore's drill-down are not in the scan lists; treat them as your files.
    const r = pathRisk.get(p) ?? 'review'
    mix[r].count += 1
    mix[r].bytes += sizeMap.get(p) ?? 0
  })
  const mixBytes = mix.safe.bytes + mix.caution.bytes + mix.review.bytes
  const toggleGroup = (risk: RiskLevel): void =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(risk)) next.delete(risk)
      else next.add(risk)
      return next
    })

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight tabular-nums">
            {formatBytes(summary.reclaimableBytes)} can go
          </h1>
          <p className="text-[13px] text-[var(--sift-text-muted)]">
            <span className="text-[var(--sift-safe)]">{formatBytes(totals.safe)}</span> of it
            rebuilds itself. The rest needs a look first.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[12.5px] text-[var(--sift-text-muted)]">
          <span title={new Date(summary.scannedAt).toLocaleString()}>
            Scanned {scanAge(summary.scannedAt)} ·{' '}
            {summary.categories.filter((c) => !c.missing).length} categories
          </span>
          {autoScanning && <span aria-live="polite">Updating…</span>}
          {pendingSummary && (
            <button
              onClick={applyPendingSummary}
              className="text-[var(--sift-accent)] hover:underline"
            >
              New scan ready · Show
            </button>
          )}
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
          {visibleCategories.length === 0 && (
            <p className="text-[13px] text-[var(--sift-text-muted)]">
              Nothing found in the places Sift checks — your Mac looks clean.
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3">
            {GROUPS.map((g) => {
              const cats = visibleCategories.filter((c) => c.risk === g.risk)
              if (cats.length === 0) return null
              const rowCats = cats.filter((c) => c.id !== 'trash')
              const rows = rowCats
                .flatMap((c) => c.items)
                .sort((x, y) => y.sizeBytes - x.sizeBytes)
                .slice(0, 3)
              const matched = rowCats.reduce(
                (n, c) => n + (c.matchedItemCount ?? c.items.length),
                0
              )
              const more = matched - rows.length
              const isOpen = openGroups.has(g.risk)
              return (
                <div key={g.risk} className="space-y-2">
                  <div className="space-y-2 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <RiskBadge risk={g.risk} />
                      <span className="text-[15px] font-semibold tabular-nums">
                        {formatBytes(totals[g.risk])}
                      </span>
                    </div>
                    <h2 className="text-[15px] font-semibold">{g.title}</h2>
                    <p className="text-[12.5px] text-[var(--sift-text-muted)]">{g.hint}</p>
                    {rows.length > 0 && (
                      <ul className="divide-y divide-[var(--sift-border)]">
                        {rows.map((item) => (
                          <li key={item.path} className="flex items-center gap-2.5 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.name}`}
                              checked={selected.has(item.path)}
                              onChange={() => toggleSelected(item.path)}
                              className="shrink-0 accent-[var(--sift-accent)]"
                            />
                            <span className="min-w-0 flex-1 truncate text-[13px]" title={item.path}>
                              {item.name}
                            </span>
                            <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                              {formatBytes(item.sizeBytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(more > 0 || cats.length > rowCats.length) && (
                      <button
                        onClick={() => toggleGroup(g.risk)}
                        aria-expanded={isOpen}
                        className="text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
                      >
                        {isOpen ? 'Hide details' : more > 0 ? `${more} more` : 'Show details'}
                      </button>
                    )}
                  </div>
                  {isOpen && cats.map((c) => <CategoryCard key={c.id} category={c} />)}
                </div>
              )
            })}
          </div>
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
              selected · moves to {bin}, recoverable
            </span>
          </span>
          {mixBytes > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex gap-3 text-[12px] text-[var(--sift-text-muted)]">
                {(['safe', 'caution', 'review'] as RiskLevel[])
                  .filter((r) => mix[r].count > 0)
                  .map((r) => (
                    <span key={r} className="tabular-nums">
                      <span aria-hidden="true" className={MIX[r].text}>
                        ●{' '}
                      </span>
                      {mix[r].count} {MIX[r].label(mix[r].count)}
                    </span>
                  ))}
              </span>
              <div aria-hidden="true" className="flex h-1.5 w-24 overflow-hidden rounded-full">
                {(['safe', 'caution', 'review'] as RiskLevel[]).map((r) => (
                  <div
                    key={r}
                    className={MIX[r].bg}
                    style={{ width: `${(mix[r].bytes / mixBytes) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={clearSelected}
              className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--sift-text-muted)] hover:bg-white/5"
            >
              Deselect
            </button>
            <button
              onClick={() => setActiveView('review')}
              className="rounded-lg bg-[var(--sift-review)] px-4 py-2 text-[12.5px] font-medium text-black"
            >
              Review and move to {bin}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
