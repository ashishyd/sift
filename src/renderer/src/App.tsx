import { useEffect } from 'react'
import clsx from 'clsx'
import { useSiftStore } from './store'
import Dashboard from './components/Dashboard'
import DuplicatesView from './components/DuplicatesView'
import FolderTree from './components/FolderTree'
import SettingsModal from './components/SettingsModal'
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
  const loadCachedSummary = useSiftStore((s) => s.loadCachedSummary)

  useEffect(() => {
    window.api.hasApiKey().then(setHasApiKey)
    window.api.hasClaudeCli().then(setHasClaudeCli)
    loadCachedSummary()
  }, [setHasApiKey, setHasClaudeCli, loadCachedSummary])

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--sift-border)] sticky top-0 bg-[var(--sift-bg)]/90 backdrop-blur z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <img src={appIcon} alt="" className="size-7 rounded-[7px]" />
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tracking-tight">Sift</span>
              <span className="text-[11px] text-[var(--sift-text-muted)]">Know before you clear.</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {(
              [
                ['dashboard', 'Dashboard'],
                ['explore', 'Explore'],
                ['duplicates', 'Duplicates']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-[13px] transition-colors',
                  activeView === id
                    ? 'bg-[var(--sift-surface-raised)] text-[var(--sift-text)]'
                    : 'text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]'
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {hasApiKey ? (
            <span className="text-[11px] text-[var(--sift-accent)]">Claude connected</span>
          ) : hasClaudeCli ? (
            <span className="text-[11px] text-[var(--sift-accent)]">Claude CLI connected</span>
          ) : null}
          <button
            onClick={() => setSettingsOpen(true)}
            className="size-8 rounded-lg border border-[var(--sift-border)] flex items-center justify-center text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'explore' && <FolderTree />}
        {activeView === 'duplicates' && <DuplicatesView />}
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
