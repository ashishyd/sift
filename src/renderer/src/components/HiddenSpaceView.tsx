import { useEffect } from 'react'
import { formatBytes, formatRelativeDate } from '../lib/format'
import { useSiftStore } from '../store'

function Section({
  title,
  detail,
  children
}: {
  title: string
  detail: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden">
      <div className="px-4 py-3.5">
        <h3 className="font-medium text-[15px]">{title}</h3>
        <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">{detail}</p>
      </div>
      <div className="border-t border-[var(--sift-border)]">{children}</div>
    </div>
  )
}

const Empty = ({ text }: { text: string }): React.JSX.Element => (
  <p className="px-4 py-3 text-[12.5px] text-[var(--sift-text-muted)]">{text}</p>
)

/** Space a Mac restart gives back (swap, held-open deleted files, snapshots) — reclaimed here without rebooting. */
export default function HiddenSpaceView(): React.JSX.Element {
  const report = useSiftStore((s) => s.hiddenSpace)
  const isScanning = useSiftStore((s) => s.isScanningHiddenSpace)
  const run = useSiftStore((s) => s.runHiddenSpaceScan)
  const quitApp = useSiftStore((s) => s.quitApp)
  const deleteSnapshots = useSiftStore((s) => s.deleteSnapshots)
  const deleteRuntime = useSiftStore((s) => s.deleteSimulatorRuntime)
  const setActiveView = useSiftStore((s) => s.setActiveView)

  useEffect(() => {
    if (!report) run()
  }, [report, run])

  // Map held-file pids onto the app that owns them so the row can offer a Quit button.
  const appForPid = (pid: number): string | null =>
    report?.memoryHogs.find((h) => h.pids.includes(pid))?.name ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[16px]">Space a restart gives back</h2>
          <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5 max-w-xl">
            Restarting your Mac empties swap, temp files and anything deleted but still held open by an
            app. Reclaim the same space here without rebooting.
          </p>
        </div>
        <button
          onClick={run}
          disabled={isScanning}
          className="rounded-lg bg-[var(--sift-accent)] px-3.5 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {isScanning ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      {report && (
        <>
          <Section
            title="Deleted files still held open"
            detail={`${formatBytes(report.heldDeletedBytes)} — emptying Trash doesn't free this until the app holding it quits.`}
          >
            {report.heldDeleted.length === 0 ? (
              <Empty text="No large deleted-but-open files right now." />
            ) : (
              <ul className="divide-y divide-[var(--sift-border)]">
                {report.heldDeleted.slice(0, 20).map((f) => {
                  const app = appForPid(f.pid)
                  return (
                    <li key={`${f.pid}:${f.path}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px]">{app ?? f.processName}</div>
                        <div className="text-[11.5px] text-[var(--sift-text-muted)] truncate" title={f.path}>
                          {f.path}
                        </div>
                      </div>
                      <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                        {formatBytes(f.sizeBytes)}
                      </span>
                      {app ? (
                        <button
                          onClick={() => quitApp(app)}
                          className="text-[12.5px] font-medium text-[var(--sift-review)] hover:underline"
                        >
                          Quit {app}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-[var(--sift-text-muted)]">
                          restart that process
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Memory swap"
            detail={`${formatBytes(report.swapUsedBytes)} of ${formatBytes(report.swapTotalBytes)} swap in use on disk. Quitting memory-heavy apps lets macOS shrink it.`}
          >
            {report.memoryHogs.length === 0 ? (
              <Empty text="No app is using a large amount of memory." />
            ) : (
              <ul className="divide-y divide-[var(--sift-border)]">
                {report.memoryHogs.map((h) => (
                  <li key={h.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[13px] flex-1">{h.name}</span>
                    <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                      {formatBytes(h.rssBytes)} RAM
                    </span>
                    <button
                      onClick={() => quitApp(h.name)}
                      className="text-[12.5px] font-medium text-[var(--sift-review)] hover:underline"
                    >
                      Quit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Simulator runtimes"
            detail="iOS/tvOS simulators Xcode downloaded. Keep the ones you test on; others can be re-downloaded from Xcode later."
          >
            {report.simulatorRuntimes.length === 0 ? (
              <Empty text="No simulator runtimes installed." />
            ) : (
              <ul className="divide-y divide-[var(--sift-border)]">
                {report.simulatorRuntimes.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px]">{r.name}</div>
                      <div className="text-[11.5px] text-[var(--sift-text-muted)]">
                        last used {formatRelativeDate(r.lastUsedAt)}
                      </div>
                    </div>
                    <span className="text-[12.5px] tabular-nums text-[var(--sift-text-muted)]">
                      {formatBytes(r.sizeBytes)}
                    </span>
                    <button
                      disabled={!r.deletable}
                      onClick={() => deleteRuntime(r.id, r.name)}
                      className="text-[12.5px] font-medium text-[var(--sift-review)] hover:underline disabled:opacity-40"
                    >
                      Delete…
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Time Machine local snapshots"
            detail="On-disk restore points macOS keeps between backups. Deleting them needs your password."
          >
            {report.snapshots.length === 0 ? (
              <Empty text="No local snapshots." />
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px]">{report.snapshots.length} snapshot(s)</span>
                <button
                  onClick={() => deleteSnapshots(report.snapshots)}
                  className="text-[12.5px] font-medium text-[var(--sift-review)] hover:underline"
                >
                  Delete all…
                </button>
              </div>
            )}
          </Section>

          <Section
            title="Temporary files & system"
            detail="Temp files live in the Dashboard under Temporary Files. The sleep image is rewritten by macOS on every sleep and can't be removed."
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-[var(--sift-text-muted)]">
                Sleep image: {formatBytes(report.sleepImageBytes)}
              </span>
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-[12.5px] font-medium text-[var(--sift-accent)] hover:underline"
              >
                Open Dashboard
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
