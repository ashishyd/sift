import { useState } from 'react'
import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'
import type { RiskLevel } from '@shared/types'
import { bin } from '../lib/platform'

const GROUPS: { risk: RiskLevel; title: string; color: string }[] = [
  { risk: 'safe', title: 'Comes back on its own', color: 'text-[var(--sift-safe)]' },
  { risk: 'caution', title: 'Look before you clear', color: 'text-[var(--sift-caution)]' },
  {
    risk: 'review',
    title: `Your files · restore them from ${bin}`,
    color: 'text-[var(--sift-review)]'
  }
]

export default function ReviewView(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const selected = useSiftStore((s) => s.selected)
  const toggleSelected = useSiftStore((s) => s.toggleSelected)
  const trashSelected = useSiftStore((s) => s.trashSelected)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const [checked, setChecked] = useState(false)

  const rows = (summary?.categories ?? []).flatMap((c) =>
    c.items
      .filter((i) => selected.has(i.path))
      .map((i) => ({ item: i, risk: c.risk, label: c.label }))
  )
  const total = rows.reduce((s, r) => s + r.item.sizeBytes, 0)
  const needsAck = rows.some((r) => r.risk === 'review')
  const canMove = rows.length > 0 && (!needsAck || checked)

  const move = async (): Promise<void> => {
    await trashSelected()
    if (useSiftStore.getState().selected.size === 0) setActiveView('dashboard')
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="min-w-0 flex-[999_1_480px] space-y-4">
        <header className="space-y-1">
          <button
            onClick={() => setActiveView('dashboard')}
            className="text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
          >
            ← Overview
          </button>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
            What happens to each item
          </h1>
          <p className="text-[13px] text-[var(--sift-text-muted)]">
            Grouped by what it costs you to get it back.
          </p>
        </header>
        {rows.length === 0 && (
          <p className="text-[13px] text-[var(--sift-text-muted)]">
            Nothing selected. Pick items on the Overview first.
          </p>
        )}
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.risk === g.risk)
          if (list.length === 0) return null
          return (
            <section
              key={g.risk}
              aria-label={g.title}
              className="overflow-hidden rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]"
            >
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <h2 className="text-[15px] font-semibold">
                  <span aria-hidden="true" className={g.color}>
                    ●{' '}
                  </span>
                  {g.title}
                </h2>
                <span className="text-[13px] tabular-nums text-[var(--sift-text-muted)]">
                  {formatBytes(list.reduce((s, r) => s + r.item.sizeBytes, 0))}
                </span>
              </div>
              <ul className="divide-y divide-[var(--sift-border)] border-t border-[var(--sift-border)]">
                {list.map(({ item, label }) => (
                  <li key={item.path} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleSelected(item.path)}
                      aria-label={`Keep ${item.name}`}
                      className="accent-[var(--sift-accent)] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]" title={item.path}>
                        {item.name}
                      </div>
                      <div className="truncate text-[11.5px] text-[var(--sift-text-muted)]">
                        {label}
                        {item.hint && ` · restore: ${item.hint}`}
                      </div>
                    </div>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                      {formatBytes(item.sizeBytes)}
                    </span>
                    <button
                      onClick={() => window.api.revealInFinder(item.path)}
                      className="shrink-0 text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
                    >
                      Reveal
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {needsAck && (
          <label className="flex items-center gap-2.5 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] px-4 py-3 text-[13px]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="accent-[var(--sift-accent)]"
            />
            I checked the items under Your files
          </label>
        )}
      </section>

      <aside
        aria-labelledby="rv-sum"
        className="min-w-0 flex-[1_1_260px] space-y-3 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
      >
        <h2 id="rv-sum" className="text-[15px] font-semibold">
          Moving to {bin}
        </h2>
        <div className="text-[32px] font-semibold leading-tight tracking-tight tabular-nums">
          {formatBytes(total)}
        </div>
        <p className="text-[12.5px] text-[var(--sift-text-muted)]">{rows.length} item(s)</p>
        <p className="text-[12px] leading-relaxed text-[var(--sift-text-muted)]">
          Everything goes to the {bin} and can be put back. Sift asks once more before it moves
          anything.
        </p>
        <button
          onClick={move}
          disabled={!canMove}
          className="w-full rounded-lg bg-[var(--sift-review)] px-4 py-2.5 text-[13px] font-medium text-black disabled:opacity-40"
        >
          {canMove || !needsAck
            ? `Move ${rows.length} item(s) to ${bin}`
            : 'Check your files to continue'}
        </button>
      </aside>
    </div>
  )
}
