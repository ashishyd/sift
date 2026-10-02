import { describe, expect, it } from 'vitest'
import { orderByOldestFirst } from './duplicates'

describe('orderByOldestFirst', () => {
  it('puts the oldest mtime first', () => {
    const mtimes = new Map([
      ['/new', 3000],
      ['/old', 1000],
      ['/mid', 2000]
    ])
    expect(orderByOldestFirst(['/new', '/old', '/mid'], mtimes)).toEqual([
      '/old',
      '/mid',
      '/new'
    ])
  })

  it('treats missing mtimes as newest so a known-old copy is kept', () => {
    const mtimes = new Map([['/known-old', 1000]])
    expect(orderByOldestFirst(['/unknown', '/known-old'], mtimes)).toEqual([
      '/known-old',
      '/unknown'
    ])
  })
})
