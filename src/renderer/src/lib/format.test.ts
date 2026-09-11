import { describe, expect, it } from 'vitest'
import { formatBytes, formatRelativeDate } from './format'

describe('formatBytes', () => {
  it('returns 0 MB for zero or negative input', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(-5)).toBe('0 MB')
  })

  it('picks the right unit', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(15 * 1024 * 1024)).toBe('15 MB')
    expect(formatBytes(30 * 1024 * 1024 * 1024)).toBe('30 GB')
  })

  it('keeps one decimal under 10 units, none at or above', () => {
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
    expect(formatBytes(12 * 1024 * 1024 * 1024)).toBe('12 GB')
  })
})

describe('formatRelativeDate', () => {
  it('returns "unknown" for null', () => {
    expect(formatRelativeDate(null)).toBe('unknown')
  })

  it('buckets recent dates correctly', () => {
    const now = Date.now()
    expect(formatRelativeDate(new Date(now).toISOString())).toBe('today')
    expect(formatRelativeDate(new Date(now - 86_400_000).toISOString())).toBe('yesterday')
    expect(formatRelativeDate(new Date(now - 5 * 86_400_000).toISOString())).toBe('5d ago')
    expect(formatRelativeDate(new Date(now - 60 * 86_400_000).toISOString())).toBe('2mo ago')
    expect(formatRelativeDate(new Date(now - 400 * 86_400_000).toISOString())).toBe('1y ago')
  })
})
