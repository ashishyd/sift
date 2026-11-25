import { useEffect, useState } from 'react'
import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'
import RiskBadge from './RiskBadge'
import { bin } from '../lib/platform'

export default function AiAppsView(): React.JSX.Element {
  const report = useSiftStore((s) => s.aiApps)
  const isScanning = useSiftStore((s) => s.isScanningAiApps)
  const runAiAppsScan = useSiftStore((s) => s.runAiAppsScan)
  const trashPaths = useSiftStore((s) => s.trashPaths)
  const quitApp = useSiftStore((s) => s.quitApp)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!report) runAiAppsScan()
  }, [report, runAiAppsScan])

  const toggle = (path: string): void =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const clear = async (paths: string[]): Promise<void> => {
    await trashPaths(paths)
    setPicked(new Set())
    await runAiAppsScan()
  }

  const pickedBytes =
    report?.apps
      .flatMap((a) => a.components)
      .filter((c) => picked.has(c.path))
      .reduce((s, c) => s + c.sizeBytes, 0) ?? 0

  const keepBytes = report ? Math.max(report.totalBytes - report.clearableBytes, 0) : 0

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight tabular-nums">
            {report ? (
              <>
                AI apps keep{' '}
                <span className="text-[var(--sift-safe)]">{formatBytes(report.totalBytes)}</span>
              </>
            ) : (
              'AI apps'
            )}
          </h1>
          <p className="text-[12.5px] text-[var(--sift-text-muted)]">
            AI apps: what Claude, Cursor and ChatGPT keep on disk, and how much of it can be
            cleared.
          </p>
        </div>
        <button
          onClick={runAiAppsScan}
          disabled={isScanning}
          className="rounded-lg border border-[var(--sift-border)] px-3.5 py-2 text-[12.5px] hover:bg-white/5 disabled:opacity-50"
        >
          {isScanning ? 'Scanning…' : 'Rescan'}
        </button>
      </header>

      {report && (
        <section
          aria-labelledby="ai-sum"
          className="space-y-3.5 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 id="ai-sum" className="text-[12.5px] text-[var(--sift-text-muted)]">
                Can be cleared
              </h2>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[32px] font-semibold tracking-tight tabular-nums">
                  {formatBytes(report.clearableBytes)}
                </span>
                <span className="text-[13px] text-[var(--sift-text-muted)] tabular-nums">
                  of {formatBytes(report.totalBytes)} used in total
                </span>
              </div>
            </div>
            <span className="text-[11.5px] text-[var(--sift-text-muted)]">
              Cleared items go to the {bin}. Chats, logins and settings are never offered.
            </span>
          </div>
          <div
            role="img"
            aria-label={`${formatBytes(report.clearableBytes)} clearable, ${formatBytes(keepBytes)} to keep`}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#1e222c]"
          >
            <div style={{ flex: `${report.clearableBytes} 1 0`, background: 'var(--sift-safe)' }} />
            <div style={{ flex: `${keepBytes} 1 0`, background: '#3a4152' }} />
          </div>
          <div className="flex gap-5 text-[11.5px] text-[var(--sift-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[var(--sift-safe)]" />
              Clearable, comes back
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#3a4152]" />
              Kept, it is yours
            </span>
          </div>
        </section>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-4">
        {report?.apps.map((app) => (
          <section
            key={app.id}
            aria-labelledby={`app-${app.id}`}
            className="overflow-hidden rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 id={`app-${app.id}`} className="text-[15px] font-semibold">
                    {app.label}
                  </h2>
                  {app.running && (
                    <span className="rounded-full bg-[var(--sift-caution)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--sift-caution)]">
                      Running
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-[var(--sift-text-muted)]">
                  {formatBytes(app.totalBytes)} total · {formatBytes(app.clearableBytes)} clearable
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={app.clearableBytes === 0}
                  onClick={() =>
                    clear(
                      app.components
                        .filter((c) => c.clearable && c.risk === 'safe')
                        .map((c) => c.path)
                    )
                  }
                  className="rounded-lg bg-[var(--sift-accent-soft)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--sift-accent)] disabled:opacity-40"
                >
                  Clear safe items
                </button>
              </div>
            </div>
            <div
              role="img"
              aria-label={`${app.label}: ${formatBytes(app.clearableBytes)} clearable, ${formatBytes(Math.max(app.totalBytes - app.clearableBytes, 0))} kept`}
              className="mx-4 mb-3.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[#1e222c]"
            >
              <div style={{ flex: `${app.clearableBytes} 1 0`, background: 'var(--sift-safe)' }} />
              <div
                style={{
                  flex: `${Math.max(app.totalBytes - app.clearableBytes, 0)} 1 0`,
                  background: '#3a4152'
                }}
              />
            </div>
            {app.running && app.runningProcessName && (
              <div
                role="status"
                className="mx-4 mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--sift-caution)]/30 bg-[var(--sift-caution)]/10 px-3.5 py-2.5 text-[12.5px]"
              >
                <span>{app.runningProcessName} is running. Quit it to clear.</span>
                <button
                  onClick={() => quitApp(app.runningProcessName!)}
                  className="font-medium text-[var(--sift-caution)] hover:underline"
                  title="Quit first so caches aren't rebuilt while you clear them"
                >
                  Quit {app.runningProcessName}
                </button>
              </div>
            )}
            {app.components.length === 0 ? (
              <p className="border-t border-[var(--sift-border)] px-4 py-3 text-[12.5px] text-[var(--sift-text-muted)]">
                Nothing found on disk.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--sift-border)] border-t border-[var(--sift-border)]">
                {app.components.map((c) => (
                  <li key={c.path} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      id={`pick-${c.path}`}
                      disabled={!c.clearable}
                      checked={picked.has(c.path)}
                      onChange={() => toggle(c.path)}
                      className="accent-[var(--sift-accent)] shrink-0"
                    />
                    <label htmlFor={`pick-${c.path}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'truncate text-[13px] ' +
                            (c.clearable ? '' : 'text-[var(--sift-text-muted)]')
                          }
                        >
                          {c.label}
                        </span>
                        <RiskBadge risk={c.risk} />
                        {!c.clearable && (
                          <span className="text-[11px] text-[var(--sift-text-muted)]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 16 16"
                              className="mr-1 inline size-3 align-[-1px]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <rect x="3" y="7" width="10" height="7" rx="1.5" />
                              <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                            </svg>
                            Kept
                          </span>
                        )}
                      </div>
                      <p
                        className="truncate text-[11.5px] text-[var(--sift-text-muted)]"
                        title={c.description}
                      >
                        {c.description}
                      </p>
                    </label>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                      {formatBytes(c.sizeBytes)}
                    </span>
                    <button
                      onClick={() => window.api.revealInFinder(c.path)}
                      className="shrink-0 text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
                    >
                      Reveal
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {report && (
        <p className="text-[11.5px] text-[var(--sift-text-muted)]">
          Why is so much kept? Chats, logins and settings are yours, so Sift never offers them. Only
          caches that the app rebuilds are clearable.
        </p>
      )}

      {picked.size > 0 && (
        <div
          role="region"
          aria-label="Selection"
          className="sticky bottom-0 -mx-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sift-border)] bg-[var(--sift-surface)]/95 px-8 py-3 backdrop-blur"
        >
          <span className="text-[13px]">
            <strong className="font-semibold tabular-nums">
              {picked.size} item(s) · {formatBytes(pickedBytes)}
            </strong>
            <span className="text-[var(--sift-text-muted)]">
              {' '}
              selected · moves to {bin}, recoverable
            </span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPicked(new Set())}
              className="rounded-lg px-3 py-2 text-[12.5px] text-[var(--sift-text-muted)] hover:bg-white/5"
            >
              Deselect
            </button>
            <button
              onClick={() => clear(Array.from(picked))}
              className="rounded-lg bg-[var(--sift-review)] px-4 py-2 text-[12.5px] font-medium text-black"
            >
              Move to {bin}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
