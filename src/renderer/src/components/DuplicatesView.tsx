import { useState } from 'react'
import { formatBytes } from '../lib/format'
import { keeperForRule } from '../lib/keeper'
import { useSiftStore } from '../store'
import { bin } from '../lib/platform'

export default function DuplicatesView(): React.JSX.Element {
  const duplicates = useSiftStore((s) => s.duplicates)
  const isScanningDuplicates = useSiftStore((s) => s.isScanningDuplicates)
  const runDuplicateScan = useSiftStore((s) => s.runDuplicateScan)
  const trashPaths = useSiftStore((s) => s.trashPaths)
  const openPrivacySettings = useSiftStore((s) => s.openPrivacySettings)
  /** hash → path to keep (defaults to oldest / files[0]) */
  const [keepers, setKeepers] = useState<Record<string, string>>({})
  /** Folder whose copy wins in every group that has one, unless a group is set by hand. */
  const [keepFolder, setKeepFolder] = useState('')
  const FOLDERS = ['Downloads', 'Documents', 'Desktop', 'Pictures']

  const fileCount = duplicates?.groups.reduce((n, g) => n + g.files.length, 0) ?? 0

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-[16px] font-semibold">Duplicate files</h1>
          <p className="text-[12.5px] text-[var(--sift-text-muted)]">
            Exact-content duplicates in Desktop, Documents, Downloads and Pictures.
          </p>
        </div>
        <button
          onClick={runDuplicateScan}
          disabled={isScanningDuplicates}
          className={
            duplicates
              ? 'rounded-lg border border-[var(--sift-border)] px-3.5 py-2 text-[12.5px] hover:bg-white/5 disabled:opacity-50'
              : 'rounded-lg bg-[var(--sift-accent)] px-3.5 py-2 text-[13px] font-medium text-black disabled:opacity-50'
          }
        >
          {isScanningDuplicates ? 'Scanning…' : duplicates ? 'Rescan' : 'Scan for duplicates'}
        </button>
      </header>

      {!duplicates && !isScanningDuplicates && (
        <ul className="divide-y divide-[var(--sift-border)] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]">
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">What a scan reads</div>
            <div className="text-[12.5px] text-[var(--sift-text-muted)]">
              {FOLDERS.join(', ')}. Files are compared by size, then by content.
            </div>
          </li>
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">macOS may ask for folder access</div>
            <div className="text-[12.5px] text-[var(--sift-text-muted)]">
              Say no and Sift skips that folder, and tells you.
            </div>
          </li>
          <li className="px-4 py-2.5">
            <div className="text-[13px] font-medium">One copy always stays</div>
            <div className="text-[12.5px] text-[var(--sift-text-muted)]">
              The other copies go to the {bin}, recoverable until you empty it.
            </div>
          </li>
        </ul>
      )}

      {isScanningDuplicates && (
        <p aria-live="polite" className="text-[12.5px] text-[var(--sift-text-muted)]">
          Scanning…
        </p>
      )}

      {duplicates && (
        <section
          aria-labelledby="dup-sum"
          className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-5"
        >
          <div className="space-y-1">
            <h2 id="dup-sum" className="text-[12.5px] text-[var(--sift-text-muted)]">
              Up to this much, by keeping one copy of each
            </h2>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[32px] font-semibold tracking-tight tabular-nums">
                {formatBytes(duplicates.reclaimableBytes)}
              </span>
              <span className="text-[13px] text-[var(--sift-text-muted)] tabular-nums">
                in {duplicates.groups.length} group(s) · {fileCount} file(s)
              </span>
            </div>
          </div>
          <p className="max-w-[300px] text-[12px] leading-relaxed text-[var(--sift-text-muted)]">
            The oldest copy is kept by default. Choose another copy in a group to keep that one
            instead. Copies moved to the {bin} are recoverable.
          </p>
        </section>
      )}

      {duplicates && duplicates.groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] px-4 py-2.5 text-[12.5px]">
          <span className="text-[var(--sift-text-muted)]">Looked in {FOLDERS.join(', ')}.</span>
          <span className="grow" />
          <label htmlFor="keep-folder" className="text-[var(--sift-text-muted)]">
            Keep the copy in
          </label>
          <select
            id="keep-folder"
            value={keepFolder}
            onChange={(e) => {
              setKeepFolder(e.target.value)
              setKeepers({})
            }}
            className="rounded-md border border-[var(--sift-border)] bg-[var(--sift-bg)] px-2 py-1 text-[12.5px]"
          >
            <option value="">the oldest</option>
            {FOLDERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {duplicates?.permissionDenied && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--sift-caution)]/30 bg-[var(--sift-caution)]/10 px-3.5 py-2.5 text-[12.5px]"
        >
          <span>
            <span aria-hidden="true" className="text-[var(--sift-caution)]">
              ⚠{' '}
            </span>
            Some folders couldn&apos;t be fully read — results may be incomplete.
          </span>
          <button
            onClick={() => openPrivacySettings('files')}
            className="font-medium text-[var(--sift-caution)] hover:underline"
          >
            Open Privacy Settings
          </button>
        </div>
      )}

      <div className="space-y-3">
        {duplicates?.groups.map((group) => {
          const keeper =
            keepers[group.hash] ?? keeperForRule(group.files, keepFolder) ?? group.files[0]
          const toTrash = group.files.filter((f) => f !== keeper)
          const chosen = keepers[group.hash] !== undefined && keeper !== group.files[0]
          const ruled = keepers[group.hash] === undefined && keeper !== group.files[0]
          return (
            <fieldset
              key={group.hash}
              className="m-0 min-w-0 overflow-hidden rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-0"
            >
              <legend className="sr-only">
                {group.files.length} copies of {group.files[0]}
              </legend>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--sift-border)] px-4 py-3">
                <span className="text-[13.5px] font-medium">
                  {group.files.length} copies{' '}
                  <span className="font-normal text-[var(--sift-text-muted)]">
                    · {formatBytes(group.sizeBytes)} each · frees{' '}
                    {formatBytes(group.sizeBytes * toTrash.length)}
                  </span>
                </span>
                <button
                  onClick={() => trashPaths(toTrash)}
                  disabled={toTrash.length === 0}
                  className="rounded-lg bg-[var(--sift-review)] px-3 py-1.5 text-[12.5px] font-medium text-black disabled:opacity-40"
                >
                  Move {toTrash.length} to {bin}
                </button>
              </div>
              <ul className="divide-y divide-[var(--sift-border)]">
                {group.files.map((f) => {
                  const isKeeper = f === keeper
                  return (
                    <li
                      key={f}
                      className={
                        'flex items-center gap-3 px-4 py-2.5 ' +
                        (isKeeper ? 'bg-[var(--sift-accent-soft)]' : '')
                      }
                    >
                      <input
                        type="radio"
                        name={`keep-${group.hash}`}
                        id={`${group.hash}:${f}`}
                        checked={isKeeper}
                        onChange={() => setKeepers((prev) => ({ ...prev, [group.hash]: f }))}
                        className="accent-[var(--sift-accent)] shrink-0"
                      />
                      <label
                        htmlFor={`${group.hash}:${f}`}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div
                          className={
                            'truncate text-[13px] ' +
                            (isKeeper ? 'text-[var(--sift-text)]' : 'text-[var(--sift-text-muted)]')
                          }
                          title={f}
                        >
                          {f}
                        </div>
                        <div
                          className={
                            'text-[11.5px] ' +
                            (isKeeper
                              ? 'text-[var(--sift-accent)]'
                              : 'text-[var(--sift-text-muted)]')
                          }
                        >
                          {isKeeper
                            ? chosen
                              ? 'Keep · you chose this'
                              : ruled
                                ? `Keep · in ${keepFolder}`
                                : 'Keep · oldest'
                            : `Moves to ${bin}`}
                        </div>
                      </label>
                      <button
                        onClick={() => window.api.revealInFinder(f)}
                        className="shrink-0 text-[11.5px] text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]"
                      >
                        Reveal
                      </button>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )
        })}
      </div>

      {duplicates && duplicates.groups.length === 0 && (
        <p className="text-[13px] text-[var(--sift-text-muted)]">
          No exact duplicates found. Nice and tidy.
        </p>
      )}
    </div>
  )
}
