import { useSiftStore } from '../store'

export default function PermissionsBanner(): React.JSX.Element | null {
  const summary = useSiftStore((s) => s.summary)
  const runScan = useSiftStore((s) => s.runScan)
  const openPrivacySettings = useSiftStore((s) => s.openPrivacySettings)

  if (!summary) return null
  const denied = summary.categories.filter((c) => c.permissionDenied)
  if (denied.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--sift-caution)]/30 bg-[var(--sift-caution)]/10 p-3.5 flex items-start gap-3">
      <span className="text-[var(--sift-caution)] text-base leading-none mt-0.5">⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px]">
          Sift couldn&apos;t fully read: <span className="font-medium">{denied.map((c) => c.label).join(', ')}</span>.
          Results for these may be incomplete.
        </p>
        <p className="text-[12px] text-[var(--sift-text-muted)] mt-0.5">
          Grant access in System Settings → Privacy &amp; Security, then rescan.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => openPrivacySettings('files')}
            className="text-[12.5px] font-medium text-[var(--sift-caution)] hover:underline"
          >
            Open Privacy Settings
          </button>
          <button onClick={runScan} className="text-[12.5px] font-medium text-[var(--sift-text-muted)] hover:underline">
            Rescan
          </button>
        </div>
      </div>
    </div>
  )
}
