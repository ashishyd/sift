import type { VolumeInfo } from '@shared/types'
import { formatBytes } from '../lib/format'

export default function VolumesList({ volumes }: { volumes: VolumeInfo[] }): React.JSX.Element | null {
  if (!volumes || volumes.length === 0) return null

  return (
    <div className="w-full mt-3 space-y-1.5 text-[12px] text-[var(--sift-text-muted)]">
      <div className="text-[11px] uppercase tracking-wide font-medium mb-1">Volumes</div>
      {volumes.map((v) => {
        const used = Math.max(0, v.totalBytes - v.freeBytes)
        const pct = v.totalBytes > 0 ? Math.round((used / v.totalBytes) * 100) : 0
        const label = v.mountPoint === '/' ? 'Macintosh HD' : v.mountPoint.replace(/^\/Volumes\//, '')
        return (
          <div key={v.mountPoint} className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="truncate" title={v.mountPoint}>
                {label}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatBytes(v.freeBytes)} free · {pct}% used
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--sift-accent)]/70"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
