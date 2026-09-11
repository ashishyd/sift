import { useState } from 'react'
import clsx from 'clsx'
import type { CategoryResult } from '@shared/types'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { useSiftStore } from '../store'
import RiskBadge from './RiskBadge'

export default function CategoryCard({ category }: { category: CategoryResult }): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const selected = useSiftStore((s) => s.selected)
  const toggleSelected = useSiftStore((s) => s.toggleSelected)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const trashPaths = useSiftStore((s) => s.trashPaths)
  const ignoreItems = useSiftStore((s) => s.ignoreItems)

  if (category.missing || category.items.length === 0) return null

  const paths = category.items.map((i) => i.path)
  const selectedCount = paths.filter((p) => selected.has(p)).length
  const allSelected = selectedCount === paths.length && paths.length > 0

  return (
    <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={clsx('size-3.5 shrink-0 text-[var(--sift-text-muted)] transition-transform', expanded && 'rotate-90')}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[15px] truncate">{category.label}</span>
              <RiskBadge risk={category.risk} />
            </div>
            <p className="text-[12.5px] text-[var(--sift-text-muted)] truncate mt-0.5">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[13px] text-[var(--sift-text-muted)]">{category.items.length} item(s)</span>
          <span className="font-semibold tabular-nums">{formatBytes(category.totalSizeBytes)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--sift-border)]">
          <div className="flex items-center justify-between px-4 py-2 bg-black/20">
            <label className="flex items-center gap-2 text-[12.5px] text-[var(--sift-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => selectAllInCategory(paths)}
                className="accent-[var(--sift-accent)]"
              />
              Select all
            </label>
            {selectedCount > 0 && (
              <button
                onClick={() => trashPaths(paths.filter((p) => selected.has(p)))}
                className="text-[12.5px] font-medium text-[var(--sift-review)] hover:underline"
              >
                Move {selectedCount} to Trash
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--sift-border)]">
            {category.items.map((item) => (
              <li key={item.path} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.02]">
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => toggleSelected(item.path)}
                  className="accent-[var(--sift-accent)] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate" title={item.path}>
                    {item.name}
                  </div>
                  <div className="text-[11.5px] text-[var(--sift-text-muted)]">
                    {item.isDirectory ? 'Folder' : 'File'} · modified {formatRelativeDate(item.lastModified)}
                  </div>
                </div>
                <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)] shrink-0">
                  {formatBytes(item.sizeBytes)}
                </span>
                <button
                  onClick={() => window.api.revealInFinder(item.path)}
                  className="text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  title="Reveal in Finder"
                >
                  Reveal
                </button>
                <button
                  onClick={() => ignoreItems([item.path])}
                  className="text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  title="Never suggest this item again"
                >
                  Ignore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
