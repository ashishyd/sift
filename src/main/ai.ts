import Anthropic from '@anthropic-ai/sdk'
import { getApiKey } from './config'
import { parseClaudeJson, type RawSuggestion } from './claudeParse'
import type { AiSuggestion, ScanSummary } from '../shared/types'

const MODEL = 'claude-haiku-4-5-20251001'

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

/** Rule-based recommendation used when no Claude API key is configured. */
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
    } categories. ${formatBytes(totalSafe)} is in caches and build artifacts that tools regenerate automatically. Add a Claude API key in Settings for tailored, plain-English guidance.`,
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
    system:
      'You are Sift, a careful macOS storage-cleanup assistant. You are given category-level disk usage summaries (labels, sizes, item counts, a few example item names) — never full file contents. ' +
      'Respond with strict JSON only, matching this TypeScript type, and nothing else: ' +
      '{ "summary": string, "recommendations": Array<{ "categoryId": string, "verdict": "clear-it" | "review-first" | "keep", "reason": string }> }. ' +
      'Be concise and specific about *why* each category is or isn\'t safe to clear. Prioritize the biggest, safest wins first in the summary.',
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

/**
 * Single entry point the IPC handler calls. Distinguishes "no key configured" (expected,
 * silent fallback) from "Claude call failed" (key exists but errored — worth telling the
 * user why, not just silently showing the local heuristic as if nothing happened).
 */
export async function getSuggestion(summary: ScanSummary): Promise<AiSuggestion> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ...localHeuristicSuggestion(summary), source: 'local' }
  }

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

/**
 * Free-text follow-up ("is invoice_2023.pdf safe to clear?") — this is where the AI
 * angle actually earns its keep over a pure heuristic tool. Requires a configured key;
 * the caller decides what to show when it throws (e.g. "no key set" / network error).
 */
export async function askAboutScan(summary: ScanSummary, question: string): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('No Claude API key configured')
  }

  const client = new Anthropic({ apiKey })
  const categoryBrief = categoryBriefFor(summary)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      'You are Sift, a careful macOS storage-cleanup assistant. You are given category-level disk usage summaries (labels, sizes, item counts, a few example item names) — never full file contents. ' +
      'Answer the user\'s question about their scan directly and concisely, in plain text (2-4 sentences, no markdown headers). ' +
      "If you don't have enough information to be sure about a specific file, say so plainly rather than guessing.",
    messages: [
      {
        role: 'user',
        content: `Scan result:\n${JSON.stringify(categoryBrief, null, 2)}\n\nQuestion: ${question}`
      }
    ]
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content')
  }
  return textBlock.text.trim()
}
