import type { AiSuggestion } from '../shared/types'

export type RawSuggestion = Omit<AiSuggestion, 'source' | 'errorReason'>

/**
 * Extracted into its own electron-free module so it's unit-testable without pulling in
 * `electron` (via config.ts) — this regex-then-parse step is exactly the kind of code that
 * silently breaks if Claude's output format drifts.
 */
export function parseClaudeJson(text: string): RawSuggestion {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse Claude response as JSON')
  }
  const parsed = JSON.parse(jsonMatch[0])
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.recommendations)) {
    throw new Error('Claude response was missing expected fields')
  }
  return parsed as RawSuggestion
}
