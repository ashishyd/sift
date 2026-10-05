import { useEffect, useState } from 'react'
import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'
import RiskBadge from './RiskBadge'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[16px]">AI apps</h2>
          <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
            What Claude, Cursor and ChatGPT keep on disk, and how much of it can be cleared.
          </p>
        </div>
        <button
          onClick={runAiAppsScan}
          disabled={isScanning}
          className="rounded-lg bg-[var(--sift-accent)] px-3.5 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {isScanning ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      {report && (
        <p className="text-[13px] text-[var(--sift-text-muted)]">
          {formatBytes(report.totalBytes)} used in total ·{' '}
          <span className="text-[var(--sift-accent)] font-medium">
            {formatBytes(report.clearableBytes)}
          </span>{' '}
          can be cleared. Cleared items go to the Trash.
        </p>
      )}

      {report?.apps.map((app) => (
        <div
          key={app.id}
          className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[15px]">{app.label}</span>
                {app.running && (
                  <span className="text-[11px] text-[var(--sift-caution)]">running</span>
                )}
              </div>
              <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
                {formatBytes(app.totalBytes)} total ·{' '}
                {formatBytes(app.clearableBytes)} clearable
              </p>
            </div>
            <div className="flex items-center gap-3">
              {app.running && app.runningProcessName && (
                <button
                  onClick={() => quitApp(app.runningProcessName!)}
                  className="text-[12.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
                  title="Quit first so caches aren't rebuilt while you clear them"
                >
                  Quit {app.runningProcessName}
                </button>
              )}
              <button
                disabled={app.clearableBytes === 0}
                onClick={() =>
                  clear(app.components.filter((c) => c.clearable && c.risk === 'safe').map((c) => c.path))
                }
                className="rounded-lg border border-[var(--sift-border)] px-3 py-1.5 text-[12.5px] hover:bg-white/5 disabled:opacity-40"
              >
                Clear safe items
              </button>
            </div>
          </div>
          {app.components.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-[var(--sift-text-muted)] border-t border-[var(--sift-border)]">
              Nothing found on disk.
            </p>
          ) : (
            <ul className="border-t border-[var(--sift-border)] divide-y divide-[var(--sift-border)]">
              {app.components.map((c) => (
                <li key={c.path} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    disabled={!c.clearable}
                    checked={picked.has(c.path)}
                    onChange={() => toggle(c.path)}
                    className="accent-[var(--sift-accent)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] truncate">{c.label}</span>
                      <RiskBadge risk={c.risk} />
                      {!c.clearable && (
                        <span className="text-[11px] text-[var(--sift-text-muted)]">keep</span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--sift-text-muted)] truncate" title={c.description}>
                      {c.description}
                    </p>
                  </div>
                  <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)] shrink-0">
                    {formatBytes(c.sizeBytes)}
                  </span>
                  <button
                    onClick={() => window.api.revealInFinder(c.path)}
                    className="text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  >
                    Reveal
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {picked.size > 0 && (
        <div className="sticky bottom-4 rounded-xl border border-[var(--sift-review)]/30 bg-[var(--sift-surface-raised)] p-3.5 flex items-center justify-between">
          <p className="text-[13px]">
            {picked.size} item(s) · {formatBytes(pickedBytes)} selected
          </p>
          <button
            onClick={() => clear(Array.from(picked))}
            className="rounded-lg bg-[var(--sift-review)] px-3 py-1.5 text-[12.5px] font-medium text-black"
          >
            Move to Trash
          </button>
        </div>
      )}
    </div>
  )
}
