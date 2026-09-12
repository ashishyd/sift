import { useState } from 'react'
import clsx from 'clsx'
import type { CategoryResult, RiskLevel, ScanItem } from '@shared/types'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { useSiftStore } from '../store'
import RiskBadge from './RiskBadge'

const RISK_TEXT_COLOR: Record<RiskLevel, string> = {
  safe: 'text-[var(--sift-safe)]',
  caution: 'text-[var(--sift-caution)]',
  review: 'text-[var(--sift-review)]'
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

function ItemRow({ item }: { item: ScanItem }): React.JSX.Element {
  const selected = useSiftStore((s) => s.selected)
  const toggleSelected = useSiftStore((s) => s.toggleSelected)
  const ignoreItems = useSiftStore((s) => s.ignoreItems)
  const isSelected = selected.has(item.path)

  return (
    <div className="flex items-center gap-2 py-1.5 pr-2 rounded-lg hover:bg-white/[0.03] group">
      <span className="w-[26px] shrink-0" />
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
        <FolderIcon className={RISK_TEXT_COLOR[category.risk]} />
        <span className="font-medium text-[13.5px] truncate">{category.label}</span>
        <RiskBadge risk={category.risk} />
      </button>
      <span className="text-[12px] text-[var(--sift-text-muted)] shrink-0">
        {category.items.length} item(s)
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[16px]">Explore</h2>
          <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
            Everything Sift found, folder by folder. Expand a category, check what to clear.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11.5px] text-[var(--sift-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--sift-safe)]" />
              Safe
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--sift-caution)]" />
              Caution
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--sift-review)]" />
              Review
            </span>
          </div>
          <button
            onClick={() =>
              setExpanded(allExpanded ? new Set() : new Set(categories.map((c) => c.id)))
            }
            className="text-[12px] text-[var(--sift-accent)] hover:underline"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-2">
        {categories.map((category) => {
          const isExpanded = expanded.has(category.id)
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
                    <ItemRow key={item.path} item={item} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--sift-review)]/30 bg-[var(--sift-review)]/10 px-4 py-2.5">
          <span className="text-[13px]">
            {selected.size} item(s) · {formatBytes(selectedBytes)} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={trashSelected}
              className="rounded-lg bg-[var(--sift-review)] px-3 py-1.5 text-[12.5px] font-medium text-black"
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
  )
}
