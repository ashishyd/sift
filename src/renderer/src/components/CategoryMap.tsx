import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategoryResult, RiskLevel } from '@shared/types'
import { formatBytes } from '../lib/format'

const RISK_FILL: Record<RiskLevel, string> = {
  safe: 'var(--sift-safe)',
  caution: 'var(--sift-caution)',
  review: 'var(--sift-review)'
}

type TreemapNode = {
  name: string
  size: number
  risk: RiskLevel
  fill: string
}

function CustomContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  fill?: string
}): React.JSX.Element | null {
  const { x = 0, y = 0, width = 0, height = 0, name = '', fill = '#3a4152' } = props
  if (width < 28 || height < 22) return null
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.35}
        stroke="var(--sift-border)"
        strokeWidth={1}
      />
      {width > 48 && height > 28 && (
        <text
          x={x + 6}
          y={y + 16}
          fill="var(--sift-text)"
          fontSize={11}
          style={{ pointerEvents: 'none' }}
        >
          {name.length > Math.floor(width / 7) ? `${name.slice(0, Math.floor(width / 7) - 1)}…` : name}
        </text>
      )}
    </g>
  )
}

export default function CategoryMap({
  categories
}: {
  categories: CategoryResult[]
}): React.JSX.Element | null {
  const data: TreemapNode[] = categories
    .filter((c) => c.id !== 'trash' && !c.missing && c.totalSizeBytes > 0)
    .map((c) => ({
      name: c.label,
      size: c.totalSizeBytes,
      risk: c.risk,
      fill: RISK_FILL[c.risk]
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 16)

  if (data.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--sift-border)]">
        <h2 className="font-semibold text-[15px]">Reclaimable map</h2>
        <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
          Category sizes by area — colored by risk.
        </p>
      </div>
      <div className="h-[200px] w-full p-2">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="var(--sift-border)"
            content={<CustomContent />}
            isAnimationActive={false}
          >
            <Tooltip
              content={({ payload }) => {
                const row = payload?.[0]?.payload as TreemapNode | undefined
                if (!row) return null
                return (
                  <div className="rounded-lg border border-[var(--sift-border)] bg-[var(--sift-surface-raised)] px-2.5 py-1.5 text-[12px]">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-[var(--sift-text-muted)]">
                      {formatBytes(row.size)} · {row.risk}
                    </div>
                  </div>
                )
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
