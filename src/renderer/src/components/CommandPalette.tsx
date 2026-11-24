import { useState } from 'react'
import { formatBytes } from '../lib/format'
import { useSiftStore, type View } from '../store'
import { isMac, modKey } from '../lib/platform'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

const VIEWS: [View, string][] = (
  [
    ['dashboard', 'Overview'],
    ['explore', 'Explore'],
    ['duplicates', 'Duplicates'],
    ['ai-apps', 'AI apps'],
    ['hidden', 'Restart space']
  ] as [View, string][]
).filter(([id]) => isMac || (id !== 'ai-apps' && id !== 'hidden'))

export default function CommandPalette(): React.JSX.Element | null {
  const open = useSiftStore((s) => s.paletteOpen)
  const setOpen = useSiftStore((s) => s.setPaletteOpen)
  const summary = useSiftStore((s) => s.summary)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const setSettingsOpen = useSiftStore((s) => s.setSettingsOpen)
  const selectAllInCategory = useSiftStore((s) => s.selectAllInCategory)
  const runScan = useSiftStore((s) => s.runScan)
  const askAi = useSiftStore((s) => s.askAi)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  if (!open) return null

  const close = (): void => setOpen(false)
  const go =
    (v: View): (() => void) =>
    () =>
      setActiveView(v)

  const commands: Command[] = [
    ...VIEWS.map(([v, label]) => ({ id: `go-${v}`, label: `Go to ${label}`, run: go(v) })),
    {
      id: 'settings',
      label: 'Open Settings',
      hint: `${modKey},`,
      run: () => setSettingsOpen(true)
    },
    { id: 'rescan', label: 'Rescan this Mac', run: () => void runScan() },
    ...(summary?.categories ?? [])
      .filter((c) => !c.missing && c.items.length > 0 && c.id !== 'trash')
      .map((c) => ({
        id: `sel-${c.id}`,
        label: `Select ${c.label} for clearing`,
        hint: formatBytes(c.totalSizeBytes),
        run: () => {
          selectAllInCategory(c.items.map((i) => i.path))
          setActiveView('dashboard')
        }
      }))
  ]

  const q = query.trim().toLowerCase()
  const matches = commands.filter((c) => !q || c.label.toLowerCase().includes(q))
  const results: Command[] =
    q.length >= 3
      ? [
          ...matches,
          {
            id: 'ask',
            label: `Ask Claude: ${query.trim()}`,
            run: () => {
              setActiveView('dashboard')
              void askAi(query.trim())
            }
          }
        ]
      : matches
  const active = Math.min(index, Math.max(results.length - 1, 0))

  const choose = (c: Command | undefined): void => {
    if (!c) return
    close()
    c.run()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[620px] max-w-[92vw] overflow-hidden rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          aria-label="Search actions and categories"
          value={query}
          placeholder="Search actions and categories"
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex(Math.min(active + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex(Math.max(active - 1, 0))
            } else if (e.key === 'Enter') choose(results[active])
          }}
          className="w-full border-b border-[var(--sift-border)] bg-transparent px-4 py-3.5 text-[15px] outline-none"
        />
        <ul role="listbox" className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-[12.5px] text-[var(--sift-text-muted)]">
              No match. Type 3 or more letters to ask Claude instead.
            </li>
          )}
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(c)}
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] ' +
                (i === active ? 'bg-[var(--sift-surface-raised)]' : '')
              }
            >
              <span className="truncate">{c.label}</span>
              {c.hint && (
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--sift-text-muted)]">
                  {c.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--sift-border)] px-4 py-2 text-[11.5px] text-[var(--sift-text-muted)]">
          ↑↓ move · ↵ run · Esc close
        </div>
      </div>
    </div>
  )
}
