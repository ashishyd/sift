import { describe, expect, it, vi } from 'vitest'
import { parseClaudeJson } from './claudeParse'
import { aiBriefPreview } from './ai'
import type { ScanSummary } from '../shared/types'

vi.mock('./config', () => ({ getApiKey: vi.fn() }))
vi.mock('./claudeCli', () => ({ runClaudeCli: vi.fn(), hasClaudeCli: vi.fn() }))

describe('parseClaudeJson', () => {
  it('parses a clean JSON response', () => {
    const text = '{"summary":"hi","recommendations":[]}'
    expect(parseClaudeJson(text)).toEqual({ summary: 'hi', recommendations: [] })
  })

  it('extracts JSON even with surrounding prose or markdown fences', () => {
    const text = 'Sure, here you go:\n```json\n{"summary":"ok","recommendations":[{"categoryId":"a","verdict":"keep","reason":"r"}]}\n```'
    expect(parseClaudeJson(text)).toEqual({
      summary: 'ok',
      recommendations: [{ categoryId: 'a', verdict: 'keep', reason: 'r' }]
    })
  })

  it('throws when there is no JSON object in the response', () => {
    expect(() => parseClaudeJson('sorry, I cannot help with that')).toThrow(/Could not parse/)
  })

  it('throws when the JSON is missing required fields', () => {
    expect(() => parseClaudeJson('{"foo":"bar"}')).toThrow(/missing expected fields/)
  })

  it('throws on malformed JSON', () => {
    expect(() => parseClaudeJson('{"summary": "unterminated')).toThrow()
  })
})

describe('aiBriefPreview', () => {
  const summary: ScanSummary = {
    scannedAt: '2026-11-24T10:00:00Z',
    volumeTotalBytes: 500,
    volumeFreeBytes: 100,
    volumes: [],
    reclaimableBytes: 42,
    categories: [
      {
        id: 'xcode-derived',
        label: 'Xcode DerivedData',
        description: 'Build output',
        risk: 'safe',
        totalSizeBytes: 40,
        matchedItemCount: 1,
        missing: false,
        permissionDenied: false,
        items: [
          {
            path: '/Users/secret/Library/Developer/Xcode/DerivedData/MyApp-abcd',
            name: 'MyApp-abcd',
            sizeBytes: 40,
            isDirectory: true,
            lastAccessed: null,
            lastModified: '2026-11-01T00:00:00Z'
          }
        ]
      },
      {
        id: 'gone',
        label: 'Missing category',
        description: '',
        risk: 'review',
        totalSizeBytes: 0,
        matchedItemCount: 0,
        missing: true,
        permissionDenied: false,
        items: []
      }
    ]
  }

  it('sends labels, sizes and names, but never a full path', () => {
    const text = aiBriefPreview(summary)
    expect(text).toContain('Xcode DerivedData')
    expect(text).toContain('MyApp-abcd')
    expect(text).not.toContain('/Users/secret')
  })

  it('leaves out categories that were not found', () => {
    expect(aiBriefPreview(summary)).not.toContain('Missing category')
  })
})
