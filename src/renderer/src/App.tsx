import { useEffect } from 'react'
import clsx from 'clsx'
import { useSiftStore, type View } from './store'
import Dashboard from './components/Dashboard'
import DuplicatesView from './components/DuplicatesView'
import FolderTree from './components/FolderTree'
import AiAppsView from './components/AiAppsView'
import HiddenSpaceView from './components/HiddenSpaceView'
import SettingsModal from './components/SettingsModal'
import { formatBytes } from './lib/format'
import appIcon from './assets/app-icon.png'

function App(): React.JSX.Element {
  const activeView = useSiftStore((s) => s.activeView)
  const setActiveView = useSiftStore((s) => s.setActiveView)
  const setSettingsOpen = useSiftStore((s) => s.setSettingsOpen)
  const hasApiKey = useSiftStore((s) => s.hasApiKey)
  const setHasApiKey = useSiftStore((s) => s.setHasApiKey)
  const hasClaudeCli = useSiftStore((s) => s.hasClaudeCli)
  const setHasClaudeCli = useSiftStore((s) => s.setHasClaudeCli)
  const toast = useSiftStore((s) => s.toast)
  const summary = useSiftStore((s) => s.summary)
  const loadCachedSummary = useSiftStore((s) => s.loadCachedSummary)

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
        {(
          [
            ['dashboard', 'Overview'],
            ['explore', 'Explore'],
            ['duplicates', 'Duplicates'],
            ['ai-apps', 'AI apps'],
            ['hidden', 'Restart space']
          ] as const
        ).map(([id, label]) => (
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
            {id === 'dashboard' && summary && summary.reclaimableBytes > 0 && (
              <span className="text-[11.5px] tabular-nums text-[var(--sift-accent)]">
                {formatBytes(summary.reclaimableBytes)}
              </span>
            )}
          </button>
        ))}
        <div className="grow" />
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
          Settings
        </button>
      </nav>

      <main className="min-w-0 flex-1 px-8 pt-6">
        <div className="max-w-5xl">
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'explore' && <FolderTree />}
          {activeView === 'duplicates' && <DuplicatesView />}
          {activeView === 'ai-apps' && <AiAppsView />}
          {activeView === 'hidden' && <HiddenSpaceView />}
        </div>
      </main>

      <SettingsModal />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--sift-surface-raised)] border border-[var(--sift-border)] px-4 py-2.5 text-[13px] shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
