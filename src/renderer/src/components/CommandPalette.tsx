import { Fragment, useState } from 'react'
import { formatBytes } from '../lib/format'
import { useSiftStore, type View } from '../store'
import { isMac, modKey } from '../lib/platform'

interface Command {
  id: string
  label: string
  hint?: string
  group: 'Actions' | 'Places'
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
  const ignoreItems = useSiftStore((s) => s.ignoreItems)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  if (!open) return null

  const close = (): void => setOpen(false)
  const go =
    (v: View): (() => void) =>
    () =>
      setActiveView(v)

  const commands: Command[] = [
    ...VIEWS.map(([v, label]) => ({
      id: `go-${v}`,
      label: `Go to ${label}`,
      group: 'Actions' as const,
      run: go(v)
    })),
    {
      id: 'settings',
      label: 'Open Settings',
      group: 'Actions',
      hint: `${modKey},`,
      run: () => setSettingsOpen(true)
    },
    { id: 'rescan', label: 'Rescan this Mac', group: 'Actions', run: () => void runScan() },
    ...(summary?.categories ?? [])
      .filter((c) => !c.missing && c.items.length > 0 && c.id !== 'trash')
      .map((c) => ({
        id: `sel-${c.id}`,
        label: `Select ${c.label} for clearing`,
        group: 'Actions' as const,
        hint: formatBytes(c.totalSizeBytes),
        run: () => {
          selectAllInCategory(c.items.map((i) => i.path))
          setActiveView('dashboard')
        }
      }))
  ]

  const q = query.trim().toLowerCase()
  const matches = commands.filter((c) => !q || c.label.toLowerCase().includes(q))
  const cats = (summary?.categories ?? []).filter((c) => !c.missing)
  const neverFlag: Command[] =
    q.length >= 3
      ? cats
          .filter((c) => c.id !== 'trash')
          .flatMap((c) => c.items)
          .filter((i) => i.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((i) => ({
            id: `never-${i.path}`,
            label: `Never flag ${i.name}`,
            group: 'Actions' as const,
            run: () => void ignoreItems([i.path])
          }))
      : []
  const askCmd: Command[] =
    q.length >= 3
      ? [
          {
            id: 'ask',
            label: `Ask Claude: ${query.trim()}`,
            hint: `${modKey}↵`,
            group: 'Actions',
            run: () => {
              setActiveView('dashboard')
              void askAi(query.trim())
            }
          }
        ]
      : []
  const places: Command[] = q
    ? cats
        .filter((c) => c.label.toLowerCase().includes(q))
        .map((c) => ({
          id: `place-${c.id}`,
          label: c.label,
          hint: 'Open in Explore',
          group: 'Places' as const,
          run: () => setActiveView('explore')
        }))
    : []
  const results: Command[] = [...matches, ...askCmd, ...places, ...neverFlag]
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
        <div className="flex items-center gap-3 border-b border-[var(--sift-border)] pr-4">
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
              else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                choose(results.find((c) => c.id === 'ask'))
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex(Math.min(active + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex(Math.max(active - 1, 0))
              } else if (e.key === 'Enter') choose(results[active])
            }}
            className="w-full bg-transparent px-4 py-3.5 text-[15px] outline-none"
          />
          <kbd className="shrink-0 rounded border border-[var(--sift-border)] px-1.5 py-0.5 text-[11px] text-[var(--sift-text-muted)]">
            Esc
          </kbd>
        </div>
        <ul role="listbox" className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-[12.5px] text-[var(--sift-text-muted)]">
              No match. Type 3 or more letters to ask Claude instead.
            </li>
          )}
          {results.map((c, i) => (
            <Fragment key={c.id}>
              {c.group !== results[i - 1]?.group && (
                <li
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-[11px] text-[var(--sift-text-muted)]"
                >
                  {c.group}
                </li>
              )}
              <li
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(c)}
                className={
                  'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] ' +
                  (i === active ? 'bg-[var(--sift-surface-raised)]' : '')
                }
              >
                <span className={'truncate' + (c.group === 'Places' ? ' font-mono' : '')}>
                  {c.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {c.hint && (
                    <span className="text-[12px] tabular-nums text-[var(--sift-text-muted)]">
                      {c.hint}
                    </span>
                  )}
                  {i === active && c.id !== 'ask' && (
                    <kbd className="rounded border border-[var(--sift-border)] px-1.5 py-0.5 text-[11px] text-[var(--sift-text-muted)]">
                      ↵
                    </kbd>
                  )}
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
        <div className="border-t border-[var(--sift-border)] px-4 py-2 text-[11.5px] text-[var(--sift-text-muted)]">
          ↑↓ move · ↵ run · Esc close
        </div>
      </div>
    </div>
  )
}
