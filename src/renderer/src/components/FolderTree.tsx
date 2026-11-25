import { useState } from 'react'
import clsx from 'clsx'
import type { CategoryResult, RiskLevel, ScanItem } from '@shared/types'
import { categoryHiddenStats } from '@shared/preferences'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { useSiftStore } from '../store'
import PermissionsBanner from './PermissionsBanner'
import { bin } from '../lib/platform'
import { matchesExploreFilter, newestModified, type ExploreFilter } from '../lib/explore'

const RISK_BG: Record<RiskLevel, string> = {
  safe: 'bg-[var(--sift-safe)]',
  caution: 'bg-[var(--sift-caution)]',
  review: 'bg-[var(--sift-review)]'
}

const RISK_TILE: Record<RiskLevel, string> = {
  safe: 'bg-[var(--sift-safe)]/15 border-[var(--sift-safe)]/40',
  caution: 'bg-[var(--sift-caution)]/15 border-[var(--sift-caution)]/40',
  review: 'bg-[var(--sift-review)]/15 border-[var(--sift-review)]/40'
}

const FILTERS: { id: ExploreFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'clearable', label: 'Clearable' },
  { id: 'untouched', label: 'Oldest items 90+ days' }
]

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: 'Safe to clear',
  caution: 'Use caution',
  review: 'Review first'
}

function Chevron({ expanded }: { expanded: boolean }): React.JSX.Element {
  return (
    <svg
      className={clsx(
        'size-3 shrink-0 text-[var(--sift-text-muted)] transition-transform',
        expanded && 'rotate-90'
      )}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 16" className={clsx('size-4 shrink-0', className)} fill="currentColor">
      <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h4.5l1.7 1.7H17a1.5 1.5 0 0 1 1.5 1.5v9.3A1.5 1.5 0 0 1 17 15H3a1.5 1.5 0 0 1-1.5-1.5v-11Z" />
    </svg>
  )
}

function FileIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 18" className="size-4 shrink-0 text-[var(--sift-text-muted)]" fill="none">
      <path
        d="M2 1.5h6.5L13 6v9.5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M8.5 1.5V6H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function ItemNode({
  item,
  depth,
  parentBytes
}: {
  item: ScanItem
  depth: number
  parentBytes: number
}): React.JSX.Element {
  const selected = useSiftStore((s) => s.selected)
  const toggleSelected = useSiftStore((s) => s.toggleSelected)
  const ignoreItems = useSiftStore((s) => s.ignoreItems)
  const loadFolder = useSiftStore((s) => s.loadFolder)
  const folderCache = useSiftStore((s) => s.folderCache)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const isSelected = selected.has(item.path)
  const listing = folderCache[item.path]
  const share =
    parentBytes > 0 ? Math.min(100, Math.round((item.sizeBytes / parentBytes) * 100)) : 0

  const toggleExpand = async (): Promise<void> => {
    if (!item.isDirectory) return
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (!listing) {
      setLoading(true)
      await loadFolder(item.path)
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 pr-2 rounded-lg hover:bg-white/[0.03] group"
        style={{ paddingLeft: depth * 14 }}
      >
        {item.isDirectory ? (
          <button onClick={toggleExpand} className="shrink-0 p-0.5" aria-label="Expand folder">
            <Chevron expanded={expanded} />
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelected(item.path)}
          className="accent-[var(--sift-accent)] shrink-0"
        />
        {item.isDirectory ? <FolderIcon className="text-[var(--sift-text-muted)]" /> : <FileIcon />}
        <span className="text-[13px] truncate flex-1" title={item.path}>
          {item.name}
        </span>
        <span className="text-[11px] text-[var(--sift-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          modified {formatRelativeDate(item.lastModified)}
        </span>
        <div
          role="img"
          aria-label={`${share}% of parent`}
          className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[#1e222c]"
        >
          <div className="h-1 bg-[var(--sift-accent)]" style={{ width: `${share}%` }} />
        </div>
        <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)] w-16 text-right shrink-0">
          {formatBytes(item.sizeBytes)}
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-[90px] justify-end">
          <button
            onClick={() => window.api.revealInFinder(item.path)}
            className="text-[11px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
          >
            Reveal
          </button>
          <button
            onClick={() => ignoreItems([item.path])}
            className="text-[11px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
          >
            Ignore
          </button>
        </div>
      </div>
      {expanded && item.isDirectory && (
        <div className="ml-[19px] border-l border-[var(--sift-border)]">
          {loading && (
            <p className="text-[12px] text-[var(--sift-text-muted)] py-1.5 pl-3">Loading…</p>
          )}
          {!loading && listing?.permissionDenied && (
            <p className="text-[12px] text-[var(--sift-caution)] py-1.5 pl-3">
              Permission denied for this folder.
            </p>
          )}
          {!loading &&
            listing?.entries.map((child) => (
              <ItemNode
                key={child.path}
                item={child}
                depth={depth + 1}
                parentBytes={item.sizeBytes}
              />
            ))}
          {!loading && listing && listing.entries.length === 0 && !listing.permissionDenied && (
            <p className="text-[12px] text-[var(--sift-text-muted)] py-1.5 pl-3">Empty folder</p>
          )}
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  category,
  totalBytes,
  expanded,
  onToggleExpand,
  onFocus
}: {
  category: CategoryResult
  totalBytes: number
  expanded: boolean
  onToggleExpand: () => void
  onFocus: () => void
}): React.JSX.Element {
  const selected = useSiftStore((s) => s.selected)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const paths = category.items.map((i) => i.path)
  const selectedCount = paths.filter((p) => selected.has(p)).length
  const allSelected = selectedCount === paths.length && paths.length > 0
  const someSelected = selectedCount > 0 && !allSelected
  const hidden = categoryHiddenStats(category)
  const share =
    totalBytes > 0 ? Math.min(100, Math.round((category.totalSizeBytes / totalBytes) * 100)) : 0

  return (
    <div className="flex items-center gap-2 py-2 pr-2 rounded-lg hover:bg-white/[0.03]">
      <button
        onClick={() => {
          onFocus()
          onToggleExpand()
        }}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <Chevron expanded={expanded} />
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={() => selectAllInCategory(paths)}
          className="accent-[var(--sift-accent)] shrink-0"
        />
        <span
          aria-hidden="true"
          className={clsx('size-2 shrink-0 rounded-sm', RISK_BG[category.risk])}
        />
        <span className="font-medium text-[13.5px] truncate">{category.label}</span>
        <span className="sr-only">{RISK_LABEL[category.risk]}</span>
      </button>
      <span className="text-[12px] text-[var(--sift-text-muted)] shrink-0">
        {category.matchedItemCount ?? category.items.length} item(s)
        {hidden.count > 0 ? ` · ${category.items.length} listed` : ''}
      </span>
      <div
        role="img"
        aria-label={`${share}% of listed`}
        className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[#1e222c]"
      >
        <div className="h-1 bg-[var(--sift-accent)]" style={{ width: `${share}%` }} />
      </div>
      <span className="text-[13px] font-semibold tabular-nums w-20 text-right shrink-0">
        {formatBytes(category.totalSizeBytes)}
      </span>
      <span className="text-[12px] tabular-nums text-[var(--sift-text-muted)] w-16 text-right shrink-0">
        {formatRelativeDate(newestModified(category))}
      </span>
    </div>
  )
}

const RISK_CONSEQUENCE: Record<CategoryResult['risk'], string> = {
  safe: 'Rebuilds on its own',
  caution: 'Usually fine, skim the list first',
  review: 'Your files: check each one'
}

function KnowPanel({ category }: { category: CategoryResult | null }): React.JSX.Element {
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const newest = category?.items.reduce<string>(
    (m, i) => (i.lastModified && i.lastModified > m ? i.lastModified : m),
    ''
  )
  const biggest = category?.items[0]
  const consequence = biggest?.hint ?? (category ? RISK_CONSEQUENCE[category.risk] : '')
  return (
    <aside
      aria-labelledby="know-h"
      className="min-w-0 flex-[1_1_260px] space-y-3 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
    >
      <span className="text-[11.5px] text-[var(--sift-text-muted)]">Know before you clear</span>
      {!category ? (
        <p id="know-h" className="text-[12.5px] text-[var(--sift-text-muted)]">
          Click a category to see what it is and what happens if you clear it.
        </p>
      ) : (
        <>
          <h2 id="know-h" className="text-[15px] font-semibold">
            {category.label}
          </h2>
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--sift-text-muted)]">
            <span
              aria-hidden="true"
              className={clsx('size-2 rounded-sm', RISK_BG[category.risk])}
            />
            {RISK_LABEL[category.risk]} ·{' '}
            <span className="tabular-nums">{formatBytes(category.totalSizeBytes)}</span> ·{' '}
            {category.matchedItemCount ?? category.items.length} item(s)
          </div>
          <p className="text-[13px] leading-relaxed">{category.description}</p>
          <p className="text-[12.5px]">
            <span className="text-[var(--sift-text-muted)]">If you clear it: </span>
            {consequence}
          </p>
          {newest && (
            <p className="text-[12.5px] text-[var(--sift-text-muted)]">
              Newest item touched {formatRelativeDate(newest)}
            </p>
          )}
          {category.permissionDenied && (
            <p className="text-[12.5px] text-[var(--sift-caution)]">
              macOS refused part of this folder, so the size may be low.
            </p>
          )}
          {biggest && (
            <p
              className="truncate font-mono text-[11.5px] text-[var(--sift-text-muted)]"
              title={biggest.path}
            >
              {biggest.path}
            </p>
          )}
          {biggest && (
            <button
              onClick={() => window.api.revealInFinder(biggest.path)}
              className="text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
            >
              Reveal in Finder
            </button>
          )}
          {category.id !== 'trash' && (
            <button
              onClick={() => selectAllInCategory(category.items.map((i) => i.path))}
              className="w-full rounded-lg bg-[var(--sift-accent-soft)] px-3 py-2 text-[12.5px] font-medium text-[var(--sift-accent)]"
            >
              Select all in this category
            </button>
          )}
        </>
      )}
    </aside>
  )
}

export default function FolderTree(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const runScan = useSiftStore((s) => s.runScan)
  const isScanning = useSiftStore((s) => s.isScanning)
  const selected = useSiftStore((s) => s.selected)
  const clearSelected = useSiftStore((s) => s.clearSelected)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const emptyTrash = useSiftStore((s) => s.emptyTrash)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ExploreFilter>('all')

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-3">
        <p className="text-[13px] text-[var(--sift-text-muted)]">
          Scan your Mac first to explore what Sift found, folder by folder.
        </p>
        <button
          onClick={runScan}
          disabled={isScanning}
          className="rounded-lg bg-[var(--sift-accent)] px-4 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {isScanning ? 'Scanning…' : 'Scan my Mac'}
        </button>
      </div>
    )
  }

  const categories = summary.categories
    .filter((c) => !c.missing && c.items.length > 0)
    .slice()
    .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)

  if (categories.length === 0) {
    return (
      <p className="text-[13px] text-[var(--sift-text-muted)]">
        Nothing found in the places Sift checks — your Mac looks clean.
      </p>
    )
  }

  const toggleExpand = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Trash has its own Empty button, so it stays out of the tiles, totals and filters.
  const visible = categories.filter((c) => c.id !== 'trash' && matchesExploreFilter(c, filter))
  const visibleBytes = visible.reduce((s, c) => s + c.totalSizeBytes, 0)
  const tiles = visible.slice(0, 6)
  const allExpanded = visible.length > 0 && visible.every((c) => expanded.has(c.id))
  const sizeMap = new Map<string, number>()
  categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
  const selectedBytes = Array.from(selected).reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)
  const trashCategory = summary.categories.find((c) => c.id === 'trash' && c.totalSizeBytes > 0)

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-[16px] font-semibold">Explore</h1>
          <p className="text-[12.5px] text-[var(--sift-text-muted)]">
            Expand categories and folders. Children are sized and sorted largest first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <div className="flex items-center gap-3 text-[var(--sift-text-muted)]">
            {(['safe', 'caution', 'review'] as const).map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={clsx('size-2 rounded-sm', RISK_BG[r])} />
                {r === 'safe' ? 'Safe' : r === 'caution' ? 'Caution' : 'Review'}
              </span>
            ))}
          </div>
          <button
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(visible.map((c) => c.id)))}
            className="rounded-lg border border-[var(--sift-border)] px-3 py-1.5 text-[12.5px] hover:bg-white/5"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </header>

      <PermissionsBanner />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-[12.5px]',
              filter === f.id
                ? 'bg-[var(--sift-accent-soft)] font-medium text-[var(--sift-accent)]'
                : 'text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tiles.length > 0 && (
        <div
          className="grid gap-1.5"
          style={{
            // Floor each tile at 8% of the total so tiny categories stay clickable.
            gridTemplateColumns: tiles
              .map((c) => `minmax(0, ${Math.max(c.totalSizeBytes, visibleBytes * 0.08, 1)}fr)`)
              .join(' ')
          }}
        >
          {tiles.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setFocusId(c.id)
                setExpanded((prev) => new Set(prev).add(c.id))
              }}
              title={`${c.label} · ${RISK_LABEL[c.risk]}`}
              className={clsx(
                'flex h-24 min-w-0 flex-col justify-between rounded-lg border p-2.5 text-left hover:brightness-125',
                RISK_TILE[c.risk]
              )}
            >
              <span className="truncate text-[12px] font-medium">{c.label}</span>
              <span className="text-[13px] font-semibold tabular-nums">
                {formatBytes(c.totalSizeBytes)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_720px] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-2">
          <div className="flex items-center gap-2 pr-2 pb-1 text-[11px] text-[var(--sift-text-muted)]">
            <span className="flex-1">Name</span>
            <span className="w-16 shrink-0">Share</span>
            <span className="w-20 shrink-0 text-right">Size</span>
            <span className="w-16 shrink-0 text-right">Last touched</span>
          </div>
          {visible.length === 0 && (
            <p className="px-2 py-3 text-[12.5px] text-[var(--sift-text-muted)]">
              No categories match this filter.
            </p>
          )}
          {visible.map((category) => {
            const isExpanded = expanded.has(category.id)
            const hidden = categoryHiddenStats(category)
            return (
              <div key={category.id}>
                <CategoryRow
                  category={category}
                  totalBytes={visibleBytes}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpand(category.id)}
                  onFocus={() => setFocusId(category.id)}
                />
                {isExpanded && (
                  <div className="ml-[19px] pl-2 border-l border-[var(--sift-border)] mb-1">
                    {category.items.map((item) => (
                      <ItemNode
                        key={item.path}
                        item={item}
                        depth={0}
                        parentBytes={category.totalSizeBytes}
                      />
                    ))}
                    {hidden.count > 0 && (
                      <p className="text-[12px] text-[var(--sift-text-muted)] py-1.5 pl-7">
                        +{hidden.count} more ({formatBytes(hidden.bytes)}) — list capped; totals
                        include them
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <KnowPanel category={categories.find((c) => c.id === focusId) ?? null} />
      </div>

      {trashCategory && (
        <div className="flex justify-end pb-4">
          <button
            onClick={emptyTrash}
            className="px-2 py-1.5 text-[12.5px] font-medium text-[var(--sift-review)] hover:underline"
          >
            Empty Trash permanently… ({formatBytes(trashCategory.totalSizeBytes)})
          </button>
        </div>
      )}

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
