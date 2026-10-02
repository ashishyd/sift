import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { ScanPreferences } from '@shared/types'
import { DEFAULT_SCAN_PREFERENCES } from '@shared/preferences'
import { useSiftStore } from '../store'
import { formatBytes, formatRelativeDate } from '../lib/format'

type SettingsTab = 'access' | 'scan' | 'ai' | 'activity'

export default function SettingsModal(): React.JSX.Element | null {
  const open = useSiftStore((s) => s.settingsOpen)
  const setOpen = useSiftStore((s) => s.setSettingsOpen)
  const hasApiKey = useSiftStore((s) => s.hasApiKey)
  const setHasApiKey = useSiftStore((s) => s.setHasApiKey)
  const hasClaudeCli = useSiftStore((s) => s.hasClaudeCli)
  const showToast = useSiftStore((s) => s.showToast)
  const permissions = useSiftStore((s) => s.permissions)
  const isCheckingPermissions = useSiftStore((s) => s.isCheckingPermissions)
  const refreshPermissions = useSiftStore((s) => s.refreshPermissions)
  const openPrivacySettings = useSiftStore((s) => s.openPrivacySettings)
  const ignoredPaths = useSiftStore((s) => s.ignoredPaths)
  const refreshIgnoredPaths = useSiftStore((s) => s.refreshIgnoredPaths)
  const unignorePath = useSiftStore((s) => s.unignorePath)
  const clearHistory = useSiftStore((s) => s.clearHistory)
  const refreshClearHistory = useSiftStore((s) => s.refreshClearHistory)
  const scanPreferences = useSiftStore((s) => s.scanPreferences)
  const loadScanPreferences = useSiftStore((s) => s.loadScanPreferences)
  const saveScanPreferences = useSiftStore((s) => s.saveScanPreferences)
  const categoryDefs = useSiftStore((s) => s.categoryDefs)
  const loadCategoryDefs = useSiftStore((s) => s.loadCategoryDefs)
  const [tab, setTab] = useState<SettingsTab>('access')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ScanPreferences>(DEFAULT_SCAN_PREFERENCES)
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!permissions) refreshPermissions()
    if (!ignoredPaths) refreshIgnoredPaths()
    refreshClearHistory()
    loadScanPreferences()
    loadCategoryDefs()
  }, [
    open,
    permissions,
    ignoredPaths,
    refreshPermissions,
    refreshIgnoredPaths,
    refreshClearHistory,
    loadScanPreferences,
    loadCategoryDefs
  ])

  useEffect(() => {
    if (scanPreferences) setDraft(scanPreferences)
  }, [scanPreferences])

  if (!open) return null

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setSaving(true)
    try {
      await window.api.setApiKey(key.trim())
      setHasApiKey(true)
      setKey('')
      showToast('Claude API key saved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save key')
    } finally {
      setSaving(false)
    }
  }

  const clear = async (): Promise<void> => {
    await window.api.clearApiKey()
    setHasApiKey(false)
    showToast('API key removed')
  }

  const savePrefs = async (): Promise<void> => {
    setSavingPrefs(true)
    try {
      await saveScanPreferences(draft)
    } finally {
      setSavingPrefs(false)
    }
  }

  const toggleCategory = (id: string): void => {
    setDraft((prev) => {
      const disabled = new Set(prev.disabledCategoryIds)
      if (disabled.has(id)) disabled.delete(id)
      else disabled.add(id)
      return { ...prev, disabledCategoryIds: Array.from(disabled) }
    })
  }

  const tabButtonClass = (id: SettingsTab): string =>
    clsx(
      'flex-1 py-1.5 rounded-md text-[12.5px] font-medium transition-colors',
      tab === id
        ? 'bg-[var(--sift-surface-raised)] text-[var(--sift-text)]'
        : 'text-[var(--sift-text-muted)] hover:text-[var(--sift-text)]'
    )

  const numberField = (
    label: string,
    keyName: keyof ScanPreferences,
    hint: string
  ): React.JSX.Element => (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--sift-text-muted)]">{label}</span>
      <input
        type="number"
        value={draft[keyName] as number}
        onChange={(e) =>
          setDraft((prev) => ({ ...prev, [keyName]: Number(e.target.value) }))
        }
        className="mt-1 w-full rounded-lg border border-[var(--sift-border)] bg-[var(--sift-bg)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--sift-accent)]"
      />
      <span className="text-[11px] text-[var(--sift-text-muted)] mt-1 block">{hint}</span>
    </label>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[500px] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface-raised)] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-[15px] mb-3.5">Settings</h2>

        <div className="flex gap-1 p-[3px] rounded-[10px] bg-[var(--sift-bg)] mb-4">
          <button onClick={() => setTab('access')} className={tabButtonClass('access')}>
            Access
          </button>
          <button onClick={() => setTab('scan')} className={tabButtonClass('scan')}>
            Scan
          </button>
          <button onClick={() => setTab('ai')} className={tabButtonClass('ai')}>
            AI
          </button>
          <button onClick={() => setTab('activity')} className={tabButtonClass('activity')}>
            Activity
          </button>
        </div>

        {tab === 'access' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-[var(--sift-text-muted)]">
                Sift needs folder access before it can see what&apos;s inside. macOS asks once per
                folder.
              </p>
              <button
                onClick={refreshPermissions}
                disabled={isCheckingPermissions}
                className="text-[12px] text-[var(--sift-accent)] hover:underline disabled:opacity-50 shrink-0"
              >
                {isCheckingPermissions ? 'Checking…' : 'Check again'}
              </button>
            </div>
            <div className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] overflow-hidden">
              {(permissions ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[13px]">{p.label}</span>
                  <span
                    className={clsx(
                      'text-[11px] font-medium px-2 py-0.5 rounded-full',
                      p.status === 'granted'
                        ? 'bg-[var(--sift-accent-soft)] text-[var(--sift-safe)]'
                        : 'bg-[var(--sift-review)]/10 text-[var(--sift-review)]'
                    )}
                  >
                    {p.status === 'granted' ? 'Access granted' : 'Access denied'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-[13px]">Full Disk Access</span>
                  <p className="text-[11px] text-[var(--sift-text-muted)]">
                    Optional — improves cache scan accuracy
                  </p>
                </div>
                <button
                  onClick={() => openPrivacySettings('full-disk-access')}
                  className="text-[11.5px] font-medium text-[var(--sift-accent)] hover:underline shrink-0"
                >
                  Open Settings
                </button>
              </div>
            </div>
            {permissions?.some((p) => p.status === 'denied') && (
              <button
                onClick={() => openPrivacySettings('files')}
                className="text-[12px] font-medium text-[var(--sift-review)] hover:underline text-left"
              >
                Fix denied folders in System Settings →
              </button>
            )}
          </div>
        )}

        {tab === 'scan' && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-[var(--sift-text-muted)]">
              Tune what Sift looks for. Changes apply on the next scan.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {numberField('Large file size (MB)', 'largeFileMinMb', 'Minimum file size')}
              {numberField('Large file age (days)', 'largeFileMinAgeDays', 'Untouched for…')}
              {numberField('Old Downloads (days)', 'downloadsMinAgeDays', 'Downloads age filter')}
              {numberField('Logs age (days)', 'logsMinAgeDays', 'Log / crash age filter')}
              {numberField('Mail downloads (days)', 'mailMinAgeDays', 'Mail attachment age')}
              {numberField('Messages (days)', 'messagesMinAgeDays', 'Attachment age')}
              {numberField('Xcode archives (days)', 'archivesMinAgeDays', 'Archive age')}
              {numberField('Background scan (hours)', 'backgroundScanHours', 'Menu bar rescan')}
            </div>

            <div>
              <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
                Categories
              </h3>
              <div className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] max-h-[180px] overflow-y-auto">
                {(categoryDefs ?? []).map((c) => {
                  const enabled = !draft.disabledCategoryIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleCategory(c.id)}
                        className="accent-[var(--sift-accent)]"
                      />
                      <span className="flex-1">{c.label}</span>
                      <span className="text-[11px] text-[var(--sift-text-muted)]">{c.risk}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDraft(DEFAULT_SCAN_PREFERENCES)}
                className="text-[12.5px] text-[var(--sift-text-muted)] hover:underline"
              >
                Reset defaults
              </button>
              <button
                onClick={savePrefs}
                disabled={savingPrefs}
                className="rounded-lg bg-[var(--sift-accent)] px-3.5 py-1.5 text-[13px] font-medium text-black disabled:opacity-40"
              >
                {savingPrefs ? 'Saving…' : 'Save scan settings'}
              </button>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[var(--sift-text-muted)]">
              Claude turns a scan into plain-English recommendations. Only category labels, sizes
              and a few example filenames are sent — never file contents.
            </p>

            <div className="flex items-center justify-between rounded-lg border border-[var(--sift-border)] px-3 py-2">
              <div>
                <span className="text-[13px]">Claude Code CLI</span>
                <p className="text-[11px] text-[var(--sift-text-muted)]">
                  {hasClaudeCli
                    ? 'Detected and ready — no API key needed.'
                    : 'Not found on this Mac. Install it and Sift will use your existing login.'}
                </p>
              </div>
              <span
                className={clsx(
                  'text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0',
                  hasClaudeCli
                    ? 'bg-[var(--sift-accent-soft)] text-[var(--sift-safe)]'
                    : 'bg-white/5 text-[var(--sift-text-muted)]'
                )}
              >
                {hasClaudeCli ? 'Ready' : 'Not found'}
              </span>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--sift-text-muted)] mb-1.5">
                Anthropic API key{' '}
                <span className="text-[var(--sift-text-muted)] font-normal">
                  (optional — used instead of the CLI if set)
                </span>
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={hasApiKey ? '•••••••••••••••••••• (key set)' : 'sk-ant-...'}
                className="w-full rounded-lg border border-[var(--sift-border)] bg-[var(--sift-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--sift-accent)]"
              />
              <p className="text-[11px] text-[var(--sift-text-muted)] mt-1.5">
                Encrypted on disk with macOS Keychain.
              </p>
            </div>

            <div className="flex items-center justify-between">
              {hasApiKey ? (
                <button
                  onClick={clear}
                  className="text-[12.5px] text-[var(--sift-review)] hover:underline"
                >
                  Remove saved key
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={save}
                disabled={saving || !key.trim()}
                className="rounded-lg bg-[var(--sift-accent)] px-3.5 py-1.5 text-[13px] font-medium text-black disabled:opacity-40 ml-auto"
              >
                {saving ? 'Saving…' : 'Save key'}
              </button>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
                Clear history
              </h3>
              <p className="text-[12.5px] text-[var(--sift-text-muted)] mb-2">
                Lifetime reclaimed:{' '}
                <span className="text-[var(--sift-text)] font-medium">
                  {formatBytes((clearHistory ?? []).reduce((s, h) => s + h.freedBytes, 0))}
                </span>
              </p>
              {clearHistory && clearHistory.length > 0 ? (
                <ul className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] max-h-[150px] overflow-y-auto">
                  {clearHistory.slice(0, 10).map((h) => (
                    <li
                      key={h.date}
                      className="flex items-center justify-between px-3 py-1.5 text-[12.5px]"
                    >
                      <span className="text-[var(--sift-text-muted)]">
                        {formatRelativeDate(h.date)} · {h.count} item(s)
                      </span>
                      <span className="font-medium">{formatBytes(h.freedBytes)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[var(--sift-text-muted)]">Nothing cleared yet.</p>
              )}
            </div>

            <div>
              <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
                Ignored items ({ignoredPaths?.length ?? 0})
              </h3>
              {ignoredPaths && ignoredPaths.length > 0 ? (
                <ul className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] max-h-[150px] overflow-y-auto">
                  {ignoredPaths.map((p) => (
                    <li key={p} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="text-[12.5px] truncate" title={p}>
                        {p.split('/').pop()}
                      </span>
                      <button
                        onClick={() => unignorePath(p)}
                        className="text-[11.5px] font-medium text-[var(--sift-accent)] hover:underline shrink-0"
                      >
                        Un-ignore
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[var(--sift-text-muted)]">
                  Items you mark &quot;Ignore&quot; won&apos;t resurface on future scans — none yet.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-3.5 py-1.5 text-[13px] text-[var(--sift-text-muted)] hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
