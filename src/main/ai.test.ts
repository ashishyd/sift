import { describe, expect, it } from 'vitest'
import { parseClaudeJson } from './claudeParse'

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
