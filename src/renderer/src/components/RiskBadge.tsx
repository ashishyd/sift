import clsx from 'clsx'
import type { RiskLevel } from '@shared/types'

const LABELS: Record<RiskLevel, string> = {
  safe: 'Safe to clear',
  caution: 'Use caution',
  review: 'Review first'
}

const STYLES: Record<RiskLevel, string> = {
  safe: 'bg-[var(--sift-accent-soft)] text-[var(--sift-safe)]',
  caution: 'bg-amber-400/10 text-[var(--sift-caution)]',
  review: 'bg-orange-500/10 text-[var(--sift-review)]'
}

export default function RiskBadge({ risk }: { risk: RiskLevel }): React.JSX.Element {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', STYLES[risk])}>
      {LABELS[risk]}
    </span>
  )
}
