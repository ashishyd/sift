import { PieChart, Pie, Cell } from 'recharts'
import { formatBytes } from '../lib/format'

export default function StorageGauge({
  totalBytes,
  freeBytes,
  reclaimableBytes
}: {
  totalBytes: number
  freeBytes: number
  reclaimableBytes: number
}): React.JSX.Element {
  const usedBytes = Math.max(totalBytes - freeBytes, 0)
  const otherUsed = Math.max(usedBytes - reclaimableBytes, 0)
  const data = [
    { name: 'Reclaimable', value: reclaimableBytes, color: 'var(--sift-accent)' },
    { name: 'Other used', value: otherUsed, color: '#3a4152' },
    { name: 'Free', value: freeBytes, color: '#1e222c' }
  ].filter((d) => d.value > 0)

  return (
    <div className="relative flex items-center justify-center">
      <PieChart width={148} height={148}>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={54}
          outerRadius={70}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[11px] text-[var(--sift-text-muted)]">Reclaimable</span>
        <span className="text-lg font-semibold">{formatBytes(reclaimableBytes)}</span>
      </div>
    </div>
  )
}
