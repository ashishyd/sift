import type { CategoryResult } from './types'

/** How one finished category came out. Four different results, never "0 items" for a refusal. */
export type StepState = 'found' | 'empty' | 'missing' | 'denied'

export interface StepResult {
  label: string
  state: StepState
  sizeBytes: number
  /** Some of it was readable, some was refused. Only meaningful with state 'found'. */
  partial: boolean
}

/** What the scan reports as it runs; `last` is the category that finished since the previous report. */
export interface ScanProgressPayload {
  label: string
  done: number
  total: number
  last?: StepResult
}

export function stepResultFromCategory(c: CategoryResult): StepResult {
  const found = c.totalSizeBytes > 0
  const state: StepState = found
    ? 'found'
    : c.permissionDenied
      ? 'denied'
      : c.missing
        ? 'missing'
        : 'empty'
  return {
    label: c.label,
    state,
    sizeBytes: c.totalSizeBytes,
    partial: found && c.permissionDenied
  }
}
