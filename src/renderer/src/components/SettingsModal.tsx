import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useSiftStore } from '../store'
import { formatBytes, formatRelativeDate } from '../lib/format'

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
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!permissions) refreshPermissions()
    if (!ignoredPaths) refreshIgnoredPaths()
    refreshClearHistory()
  }, [open, permissions, ignoredPaths, refreshPermissions, refreshIgnoredPaths, refreshClearHistory])

  if (!open) return null

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setSaving(true)
    try {
      await window.api.setApiKey(key.trim())
      setHasApiKey(true)
      setKey('')
      showToast('Claude API key saved')
      setOpen(false)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="w-[440px] rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface-raised)] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-[15px] mb-1">Settings</h2>

        <div className="mt-3 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide">
              Folder access
            </h3>
            <button
              onClick={refreshPermissions}
              disabled={isCheckingPermissions}
              className="text-[12px] text-[var(--sift-accent)] hover:underline disabled:opacity-50"
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
                <p className="text-[11px] text-[var(--sift-text-muted)]">Optional — improves cache scan accuracy</p>
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
              className="mt-2 text-[12px] font-medium text-[var(--sift-review)] hover:underline"
            >
              Fix denied folders in System Settings →
            </button>
          )}
        </div>

        <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
          Claude AI
        </h3>
        <p className="text-[12.5px] text-[var(--sift-text-muted)] mb-2">
          Sift can call Claude to turn your scan into plain-English recommendations. Only category labels, sizes and
          a few example filenames are sent — never file contents.
        </p>

        <div className="flex items-center justify-between rounded-lg border border-[var(--sift-border)] px-3 py-2 mb-4">
          <div>
            <span className="text-[13px]">Claude Code CLI</span>
            <p className="text-[11px] text-[var(--sift-text-muted)]">
              {hasClaudeCli
                ? 'Detected and ready — no API key needed.'
                : "Not found on this Mac. Install it and Sift will use your existing login."}
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

        <label className="block text-[12px] font-medium text-[var(--sift-text-muted)] mb-1.5">
          Anthropic API key <span className="text-[var(--sift-text-muted)] font-normal">(optional — used instead of the CLI if set)</span>
        </label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={hasApiKey ? '•••••••••••••••••••• (key set)' : 'sk-ant-...'}
          className="w-full rounded-lg border border-[var(--sift-border)] bg-[var(--sift-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--sift-accent)]"
        />
        <p className="text-[11px] text-[var(--sift-text-muted)] mt-1.5">Encrypted on disk with macOS Keychain.</p>

        {clearHistory && clearHistory.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
              History
            </h3>
            <p className="text-[12.5px] text-[var(--sift-text-muted)] mb-2">
              Lifetime reclaimed:{' '}
              <span className="text-[var(--sift-text)] font-medium">
                {formatBytes(clearHistory.reduce((s, h) => s + h.freedBytes, 0))}
              </span>
            </p>
            <ul className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] max-h-36 overflow-y-auto">
              {clearHistory.slice(0, 10).map((h) => (
                <li key={h.date} className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
                  <span className="text-[var(--sift-text-muted)]">
                    {formatRelativeDate(h.date)} · {h.count} item(s)
                  </span>
                  <span className="font-medium">{formatBytes(h.freedBytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ignoredPaths && ignoredPaths.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[12px] font-medium text-[var(--sift-text-muted)] uppercase tracking-wide mb-1.5">
              Ignored items ({ignoredPaths.length})
            </h3>
            <ul className="rounded-lg border border-[var(--sift-border)] divide-y divide-[var(--sift-border)] max-h-36 overflow-y-auto">
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
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          {hasApiKey ? (
            <button onClick={clear} className="text-[12.5px] text-[var(--sift-review)] hover:underline">
              Remove saved key
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-[13px] text-[var(--sift-text-muted)] hover:bg-white/5"
            >
              Close
            </button>
            <button
              onClick={save}
              disabled={saving || !key.trim()}
              className="rounded-lg bg-[var(--sift-accent)] px-3 py-1.5 text-[13px] font-medium text-black disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
