import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { RiskLevel } from '@shared/types'
import { formatBytes } from '../lib/format'
import { useSiftStore } from '../store'

const RISK_COLOR: Record<RiskLevel, string> = {
  safe: '#5ee6c8',
  caution: '#f5c451',
  review: '#f57a5e'
}

interface TreemapLeaf {
  [key: string]: unknown
  name: string
  size: number
  risk: RiskLevel
  path: string
}

interface TreemapNode {
  [key: string]: unknown
  name: string
  risk: RiskLevel
  children: TreemapLeaf[]
}

const MAX_ITEMS_PER_CATEGORY = 25

function buildTreemapData(
  categories: Array<{
    id: string
    label: string
    risk: RiskLevel
    missing: boolean
    items: Array<{ path: string; name: string; sizeBytes: number }>
  }>
): TreemapNode[] {
  return categories
    .filter((c) => !c.missing && c.items.length > 0)
    .map((c) => ({
      name: c.label,
      risk: c.risk,
      children: c.items
        .slice(0, MAX_ITEMS_PER_CATEGORY)
        .map((i) => ({ name: i.name, size: i.sizeBytes, risk: c.risk, path: i.path }))
    }))
    .filter((c) => c.children.length > 0)
}

function TreemapCell(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  size?: number
  risk?: RiskLevel
  depth?: number
}): React.JSX.Element {
  const { x = 0, y = 0, width = 0, height = 0, name, size, risk, depth } = props
  const isLeaf = depth === 2
  const fill = risk ? RISK_COLOR[risk] : '#3a4152'
  const showLabel = width > 46 && height > 24

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isLeaf ? fill : 'transparent'}
        fillOpacity={isLeaf ? 0.85 : 1}
        stroke="var(--sift-bg)"
        strokeWidth={isLeaf ? 1.5 : 3}
      />
      {isLeaf && showLabel && (
        <text x={x + 6} y={y + 16} fontSize={11} fill="#0b0d12" fontWeight={600}>
          {name && name.length > Math.floor(width / 7) ? `${name.slice(0, Math.floor(width / 7))}…` : name}
        </text>
      )}
      {isLeaf && showLabel && height > 36 && (
        <text x={x + 6} y={y + 30} fontSize={10} fill="#0b0d12" fillOpacity={0.75}>
          {size !== undefined ? formatBytes(size) : ''}
        </text>
      )}
      {!isLeaf && width > 60 && height > 18 && (
        <text x={x + 6} y={y + 14} fontSize={12} fontWeight={600} fill="var(--sift-text-muted)">
          {name}
        </text>
      )}
    </g>
  )
}

function TreemapTooltipContent({
  active,
  payload
}: {
  active?: boolean
  payload?: Array<{ payload: TreemapLeaf }>
}): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null
  const leaf = payload[0].payload
  if (leaf.size === undefined) return null
  return (
    <div className="rounded-lg border border-[var(--sift-border)] bg-[var(--sift-surface-raised)] px-3 py-2 text-[12px] shadow-xl max-w-xs">
      <div className="font-medium truncate">{leaf.name}</div>
      <div className="text-[var(--sift-text-muted)]">{formatBytes(leaf.size)}</div>
    </div>
  )
}

export default function TreemapView(): React.JSX.Element {
  const summary = useSiftStore((s) => s.summary)
  const runScan = useSiftStore((s) => s.runScan)
  const isScanning = useSiftStore((s) => s.isScanning)

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-3">
        <p className="text-[13px] text-[var(--sift-text-muted)]">Scan your Mac first to explore its layout.</p>
        <button
          onClick={runScan}
          disabled={isScanning}
          className="rounded-lg bg-[var(--sift-accent)] px-4 py-2 text-[13px] font-medium text-black disabled:opacity-50"
        >
          {isScanning ? 'Scanning…' : 'Scan my Mac'}
        </button>
      </div>
    )
  }

  const data = buildTreemapData(summary.categories)

  if (data.length === 0) {
    return (
      <p className="text-[13px] text-[var(--sift-text-muted)]">Nothing to show — your Mac looks clean.</p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-[16px]">Explore</h2>
        <p className="text-[12.5px] text-[var(--sift-text-muted)] mt-0.5">
          Every item Sift found, sized by how much space it takes — grouped by category, colored by risk (
          <span className="text-[var(--sift-safe)]">safe</span>,{' '}
          <span className="text-[var(--sift-caution)]">caution</span>,{' '}
          <span className="text-[var(--sift-review)]">review</span>).
        </p>
      </div>
      <div className="rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)] p-2" style={{ height: 520 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="var(--sift-bg)"
            content={<TreemapCell />}
            isAnimationActive={false}
          >
            <Tooltip content={<TreemapTooltipContent />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
