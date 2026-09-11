import Anthropic from '@anthropic-ai/sdk'
import { getApiKey } from './config'
import { runClaudeCli, hasClaudeCli as checkClaudeCli } from './claudeCli'
import { parseClaudeJson, type RawSuggestion } from './claudeParse'
import type { AiSuggestion, ScanSummary } from '../shared/types'

const MODEL = 'claude-haiku-4-5-20251001'

const SUGGESTION_SYSTEM_PROMPT =
  'You are Sift, a careful macOS storage-cleanup assistant. You are given category-level disk usage summaries (labels, sizes, item counts, a few example item names) — never full file contents. ' +
  'Respond with strict JSON only, matching this TypeScript type, and nothing else: ' +
  '{ "summary": string, "recommendations": Array<{ "categoryId": string, "verdict": "clear-it" | "review-first" | "keep", "reason": string }> }. ' +
  "Be concise and specific about *why* each category is or isn't safe to clear. Prioritize the biggest, safest wins first in the summary."

const QA_SYSTEM_PROMPT =
  'You are Sift, a careful macOS storage-cleanup assistant. You are given category-level disk usage summaries (labels, sizes, item counts, a few example item names) — never full file contents. ' +
  "Answer the user's question about their scan directly and concisely, in plain text (2-4 sentences, no markdown headers). " +
  "If you don't have enough information to be sure about a specific file, say so plainly rather than guessing."

export async function hasClaudeCli(): Promise<boolean> {
  return checkClaudeCli()
}

function formatBytes(n: number): string {
  if (n <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

/** Rule-based recommendation used when no Claude API key or CLI is available. */
export function localHeuristicSuggestion(summary: ScanSummary): RawSuggestion {
  const recommendations = summary.categories
    .filter((c) => !c.missing && c.totalSizeBytes > 0)
    .map((c) => {
      const verdict: 'clear-it' | 'review-first' | 'keep' =
        c.risk === 'safe' ? 'clear-it' : c.risk === 'caution' ? 'review-first' : 'review-first'
      const reason =
        c.risk === 'safe'
          ? `${c.description} Regenerated automatically — safe to clear ${formatBytes(c.totalSizeBytes)}.`
          : `${c.description} Skim the ${c.items.length} item(s) before clearing ${formatBytes(c.totalSizeBytes)}.`
      return { categoryId: c.id, verdict, reason }
    })
    .sort((a) => (a.verdict === 'clear-it' ? -1 : 1))

  const totalSafe = summary.categories
    .filter((c) => c.risk === 'safe')
    .reduce((s, c) => s + c.totalSizeBytes, 0)

  return {
    summary: `Local scan found ${formatBytes(summary.reclaimableBytes)} of reclaimable space across ${
      summary.categories.filter((c) => !c.missing).length
    } categories. ${formatBytes(totalSafe)} is in caches and build artifacts that tools regenerate automatically. Add a Claude API key or install Claude Code in Settings for tailored, plain-English guidance.`,
    recommendations
  }
}

function categoryBriefFor(summary: ScanSummary): unknown {
  return summary.categories
    .filter((c) => !c.missing)
    .map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      risk: c.risk,
      totalSizeBytes: c.totalSizeBytes,
      itemCount: c.items.length,
      topItems: c.items.slice(0, 8).map((i) => ({ name: i.name, sizeBytes: i.sizeBytes, lastModified: i.lastModified }))
    }))
}

/** Sends only category-level metadata (labels, sizes, counts, risk) to Claude — never file contents, never individual filenames outside the categories the user is already viewing. */
async function getClaudeSuggestion(summary: ScanSummary, apiKey: string): Promise<RawSuggestion> {
  const client = new Anthropic({ apiKey })
  const categoryBrief = categoryBriefFor(summary)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SUGGESTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the scan result:\n${JSON.stringify(categoryBrief, null, 2)}`
      }
    ]
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content')
  }

  return parseClaudeJson(textBlock.text)
}

/** Same call, but via the user's local, already-authenticated Claude Code CLI — no API key needed. */
async function getClaudeCliSuggestion(summary: ScanSummary): Promise<RawSuggestion> {
  const categoryBrief = categoryBriefFor(summary)
  const text = await runClaudeCli(
    SUGGESTION_SYSTEM_PROMPT,
    `Here is the scan result:\n${JSON.stringify(categoryBrief, null, 2)}`
  )
  return parseClaudeJson(text)
}

/**
 * Single entry point the IPC handler calls. Tries, in order: an Anthropic API key, the
 * local Claude Code CLI, then the offline heuristic. Distinguishes "nothing configured"
 * (expected, silent fallback) from "a Claude call actually failed" (worth telling the user
 * why, not just silently showing the local heuristic as if nothing happened).
 */
export async function getSuggestion(summary: ScanSummary): Promise<AiSuggestion> {
  const apiKey = await getApiKey()
  if (apiKey) {
    try {
      const result = await getClaudeSuggestion(summary, apiKey)
      return { ...result, source: 'claude' }
    } catch (err) {
      return {
        ...localHeuristicSuggestion(summary),
        source: 'local',
        errorReason: err instanceof Error ? err.message : 'Claude request failed'
      }
    }
  }

  if (await checkClaudeCli()) {
    try {
      const result = await getClaudeCliSuggestion(summary)
      return { ...result, source: 'claude-cli' }
    } catch (err) {
      return {
        ...localHeuristicSuggestion(summary),
        source: 'local',
        errorReason: err instanceof Error ? err.message : 'Claude CLI request failed'
      }
    }
  }

  return { ...localHeuristicSuggestion(summary), source: 'local' }
}

/**
 * Free-text follow-up ("is invoice_2023.pdf safe to clear?") — this is where the AI
 * angle actually earns its keep over a pure heuristic tool. Tries an API key first, then
 * the local Claude CLI; throws if neither is available so the caller can show why.
 */
export async function askAboutScan(summary: ScanSummary, question: string): Promise<string> {
  const apiKey = await getApiKey()
  const categoryBrief = categoryBriefFor(summary)
  const userContent = `Scan result:\n${JSON.stringify(categoryBrief, null, 2)}\n\nQuestion: ${question}`

  if (apiKey) {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: QA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }]
    })
    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content')
    }
    return textBlock.text.trim()
  }

  if (await checkClaudeCli()) {
    return runClaudeCli(QA_SYSTEM_PROMPT, userContent)
  }

  throw new Error('No Claude API key configured and Claude CLI not found')
}
