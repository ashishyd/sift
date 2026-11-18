import { useState } from 'react'
import clsx from 'clsx'
import type { CategoryResult, RiskLevel, ScanItem } from '@shared/types'
import { categoryHiddenStats } from '@shared/preferences'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { useSiftStore } from '../store'

const RISK_BG: Record<RiskLevel, string> = {
  safe: 'bg-[var(--sift-safe)]',
  caution: 'bg-[var(--sift-caution)]',
  review: 'bg-[var(--sift-review)]'
}

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
          className="h-1 w-[120px] shrink-0 overflow-hidden rounded-full bg-[#1e222c]"
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
  expanded,
  onToggleExpand
}: {
  category: CategoryResult
  expanded: boolean
  onToggleExpand: () => void
}): React.JSX.Element {
  const selected = useSiftStore((s) => s.selected)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const paths = category.items.map((i) => i.path)
  const selectedCount = paths.filter((p) => selected.has(p)).length
  const allSelected = selectedCount === paths.length && paths.length > 0
  const someSelected = selectedCount > 0 && !allSelected
  const hidden = categoryHiddenStats(category)

  return (
    <div className="flex items-center gap-2 py-2 pr-2 rounded-lg hover:bg-white/[0.03]">
      <button onClick={onToggleExpand} className="flex items-center gap-2 flex-1 min-w-0 text-left">
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
      <span className="text-[13px] font-semibold tabular-nums w-20 text-right shrink-0">
        {formatBytes(category.totalSizeBytes)}
      </span>
    </div>
  )
}

export default function FolderTree(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const runScan = useSiftStore((s) => s.runScan)
  const isScanning = useSiftStore((s) => s.isScanning)
  const selected = useSiftStore((s) => s.selected)
  const clearSelected = useSiftStore((s) => s.clearSelected)
  const trashSelected = useSiftStore((s) => s.trashSelected)
  const emptyTrash = useSiftStore((s) => s.emptyTrash)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  const allExpanded = categories.every((c) => expanded.has(c.id))
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
            onClick={() =>
              setExpanded(allExpanded ? new Set() : new Set(categories.map((c) => c.id)))
            }
            className="rounded-lg border border-[var(--sift-border)] px-3 py-1.5 text-[12.5px] hover:bg-white/5"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-2">
        {categories.map((category) => {
          const isExpanded = expanded.has(category.id)
          const hidden = categoryHiddenStats(category)
          return (
            <div key={category.id}>
              <CategoryRow
                category={category}
                expanded={isExpanded}
                onToggleExpand={() => toggleExpand(category.id)}
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
