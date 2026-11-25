import { useEffect } from 'react'
import clsx from 'clsx'
import { useSiftStore, type View } from './store'
import Dashboard from './components/Dashboard'
import DuplicatesView from './components/DuplicatesView'
import FolderTree from './components/FolderTree'
import AiAppsView from './components/AiAppsView'
import HiddenSpaceView from './components/HiddenSpaceView'
import ReviewView from './components/ReviewView'
import CommandPalette from './components/CommandPalette'
import SettingsModal from './components/SettingsModal'
import { formatBytes } from './lib/format'
import { riskTotals } from '@shared/reclaimable'
import { isMac, modKey } from './lib/platform'
import appIcon from './assets/app-icon.png'

/** AI apps and Restart space read macOS-only locations, so Windows does not list them. */
const SECTIONS: ReadonlyArray<readonly [View, string]> = (
  [
    ['dashboard', 'Overview'],
    ['explore', 'Explore'],
    ['duplicates', 'Duplicates'],
    ['ai-apps', 'AI apps'],
    ['hidden', 'Restart space']
  ] as const
).filter(([id]) => isMac || (id !== 'ai-apps' && id !== 'hidden'))

function App(): React.JSX.Element {
  const activeView = useSiftStore((s) => s.activeView)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const setSettingsOpen = useSiftStore((s) => s.setSettingsOpen)
  const setPaletteOpen = useSiftStore((s) => s.setPaletteOpen)
  const hasApiKey = useSiftStore((s) => s.hasApiKey)
  const setHasApiKey = useSiftStore((s) => s.setHasApiKey)
  const hasClaudeCli = useSiftStore((s) => s.hasClaudeCli)
  const setHasClaudeCli = useSiftStore((s) => s.setHasClaudeCli)
  const toast = useSiftStore((s) => s.toast)
  const summary = useSiftStore((s) => s.summary)
  const loadCachedSummary = useSiftStore((s) => s.loadCachedSummary)
  const duplicates = useSiftStore((s) => s.duplicates)
  const aiApps = useSiftStore((s) => s.aiApps)
  const hiddenSpace = useSiftStore((s) => s.hiddenSpace)

  const startup = summary?.volumes?.[0]
  const reclaimable = summary?.reclaimableBytes ?? 0
  const safeBytes = summary ? riskTotals(summary.categories).safe : 0

  const meta: Partial<Record<View, number>> = {
    dashboard: summary?.reclaimableBytes,
    duplicates: duplicates?.reclaimableBytes,
    'ai-apps': aiApps?.clearableBytes,
    hidden: hiddenSpace ? hiddenSpace.heldDeletedBytes + hiddenSpace.swapUsedBytes : undefined
  }

  useEffect(() => {
    const order = SECTIONS.map(([id]) => id)
    const onKey = (e: KeyboardEvent): void => {
      if (!(isMac ? e.metaKey : e.ctrlKey)) return
      if (e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
        return
      }
      const view = order[Number(e.key) - 1]
      if (view) {
        e.preventDefault()
        setActiveView(view)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveView, setSettingsOpen, setPaletteOpen])

  useEffect(
    () =>
      window.api.onNavigate((view) => {
        if (['dashboard', 'explore', 'duplicates', 'ai-apps', 'hidden'].includes(view)) {
          setActiveView(view as View)
        }
      }),
    [setActiveView]
  )

  const onAutoScanProgress = useSiftStore((s) => s.onAutoScanProgress)
  const onAutoScanState = useSiftStore((s) => s.onAutoScanState)
  const onAutoScanUpdated = useSiftStore((s) => s.onAutoScanUpdated)

  useEffect(() => {
    const offs = [
      window.api.onScanProgress(onAutoScanProgress),
      window.api.onScanState(onAutoScanState),
      window.api.onScanUpdated(onAutoScanUpdated)
    ]
    return () => offs.forEach((off) => off())
  }, [onAutoScanProgress, onAutoScanState, onAutoScanUpdated])

  useEffect(() => {
    window.api.hasApiKey().then(setHasApiKey)
    window.api.hasClaudeCli().then(setHasClaudeCli)
    loadCachedSummary()
  }, [setHasApiKey, setHasClaudeCli, loadCachedSummary])

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Sections"
        className="sticky top-0 flex h-screen w-[216px] shrink-0 flex-col gap-1 border-r border-[var(--sift-border)] px-3 py-5"
      >
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <img src={appIcon} alt="" className="size-7 rounded-[7px]" />
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight">Sift</span>
            <span className="text-[11px] text-[var(--sift-text-muted)]">
              Know before you clear.
            </span>
          </div>
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-1.5 flex items-center justify-between rounded-lg border border-[var(--sift-border)] px-2.5 py-2 text-left text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
        >
          Search
          <span className="text-[11px]">{modKey}K</span>
        </button>
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            aria-current={activeView === id ? 'page' : undefined}
            className={clsx(
              'flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
              activeView === id
                ? 'bg-[var(--sift-surface-raised)] text-[var(--sift-text)]'
                : 'text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]'
            )}
          >
            {label}
            {(meta[id] ?? 0) > 0 && (
              <span
                className={clsx(
                  'text-[11.5px] tabular-nums',
                  id === 'dashboard' ? 'text-[var(--sift-accent)]' : 'text-[var(--sift-text-muted)]'
                )}
              >
                {formatBytes(meta[id] ?? 0)}
              </span>
            )}
          </button>
        ))}
        <div className="grow" />
        {startup && (
          <div className="mb-1.5 space-y-1.5 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-3 text-[12px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">
                {startup.mountPoint === '/' || /^[A-Za-z]:/.test(startup.mountPoint)
                  ? 'Startup disk'
                  : startup.mountPoint}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--sift-text-muted)]">
                {formatBytes(startup.freeBytes)} free
              </span>
            </div>
            <div
              role="img"
              aria-label={`${formatBytes(startup.totalBytes - startup.freeBytes)} used, ${formatBytes(reclaimable)} reclaimable`}
              className="flex h-1 gap-px overflow-hidden rounded-full bg-[#1e222c]"
            >
              <div
                style={{
                  flex: `${Math.max(startup.totalBytes - startup.freeBytes - reclaimable, 0)} 1 0`,
                  background: '#3a4152'
                }}
              />
              <div style={{ flex: `${reclaimable} 1 0`, background: 'var(--sift-safe)' }} />
              <div style={{ flex: `${startup.freeBytes} 1 0` }} />
            </div>
            <div className="tabular-nums text-[11.5px] text-[var(--sift-text-muted)]">
              {formatBytes(startup.freeBytes + safeBytes)} free if you clear safe items
            </div>
          </div>
        )}
        {(hasApiKey || hasClaudeCli) && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] p-2.5 text-[12px]">
            <span className="size-1.5 rounded-full bg-[var(--sift-accent)]" />
            {hasApiKey ? 'Claude connected' : 'Claude CLI connected'}
          </div>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
        >
          <span aria-hidden="true">⚙</span>
          <span className="grow">Settings</span>
          <span className="text-[11px]">{modKey},</span>
        </button>
      </nav>

      <main className="min-w-0 flex-1 px-8 pt-6">
        <div className="max-w-5xl">
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'explore' && <FolderTree />}
          {activeView === 'duplicates' && <DuplicatesView />}
          {activeView === 'ai-apps' && <AiAppsView />}
          {activeView === 'hidden' && <HiddenSpaceView />}
          {activeView === 'review' && <ReviewView />}
        </div>
      </main>

      <SettingsModal />
      <CommandPalette />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--sift-surface-raised)] border border-[var(--sift-border)] px-4 py-2.5 text-[13px] shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
