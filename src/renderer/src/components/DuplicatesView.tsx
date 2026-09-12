import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'

export default function DuplicatesView(): React.JSX.Element {
  const duplicates = useSiftStore((s) => s.duplicates)
  const isScanningDuplicates = useSiftStore((s) => s.isScanningDuplicates)
  const runDuplicateScan = useSiftStore((s) => s.runDuplicateScan)
  const trashPaths = useSiftStore((s) => s.trashPaths)
  const openPrivacySettings = useSiftStore((s) => s.openPrivacySettings)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[16px]">Duplicate files</h2>
          <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
            Exact-content duplicates in Desktop, Documents, Downloads and Pictures.
          </p>
        </div>
        <button
          onClick={runDuplicateScan}
          disabled={isScanningDuplicates}
          className="rounded-lg bg-[var(--sift-accent)] px-3.5 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {isScanningDuplicates ? 'Scanning…' : duplicates ? 'Rescan' : 'Scan for duplicates'}
        </button>
      </div>

      {duplicates && (
        <div>
          <p className="text-[13px] text-[var(--sift-text-muted)]">
            Found {duplicates.groups.length} duplicate group(s) — up to{' '}
            <span className="text-[var(--sift-accent)] font-medium">
              {formatBytes(duplicates.reclaimableBytes)}
            </span>{' '}
            reclaimable by keeping one copy of each.
          </p>
          <p className="text-[12px] text-[var(--sift-text-muted)]/80 mt-0.5">
            Sift keeps the oldest copy of each and moves the rest to Trash — check the list if
            you&apos;d rather keep a different one.
          </p>
        </div>
      )}

      {duplicates?.permissionDenied && (
        <div className="rounded-xl border border-[var(--sift-caution)]/30 bg-[var(--sift-caution)]/10 p-3.5 flex items-start gap-3">
          <span className="text-[var(--sift-caution)] text-base leading-none mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-[13px]">
              Some folders couldn&apos;t be fully read — results may be incomplete.
            </p>
            <button
              onClick={() => openPrivacySettings('files')}
              className="text-[12.5px] font-medium text-[var(--sift-caution)] hover:underline mt-1"
            >
              Open Privacy Settings
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {duplicates?.groups.map((group) => (
          <div
            key={group.hash}
            className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12.5px] text-[var(--sift-text-muted)]">
                {group.files.length} copies · {formatBytes(group.sizeBytes)} each
              </span>
              <button
                onClick={() => trashPaths(group.files.slice(1))}
                className="text-[12px] font-medium text-[var(--sift-review)] hover:underline"
              >
                Keep oldest, trash the rest
              </button>
            </div>
            <ul className="space-y-1">
              {group.files.map((f, idx) => (
                <li key={f} className="flex items-center justify-between text-[12.5px] gap-3">
                  <span
                    className={
                      idx === 0 ? 'text-[var(--sift-text)]' : 'text-[var(--sift-text-muted)]'
                    }
                    title={f}
                  >
                    {idx === 0 && <span className="text-[var(--sift-accent)] mr-1">Keep ·</span>}
                    {f}
                  </span>
                  <button
                    onClick={() => window.api.revealInFinder(f)}
                    className="text-[11px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)] shrink-0"
                  >
                    Reveal
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {duplicates && duplicates.groups.length === 0 && (
        <p className="text-[13px] text-[var(--sift-text-muted)]">
          No exact duplicates found. Nice and tidy.
        </p>
      )}
    </div>
  )
}
