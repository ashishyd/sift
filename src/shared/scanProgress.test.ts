import { describe, expect, it } from 'vitest'
import { stepResultFromCategory } from './scanProgress'
import type { CategoryResult } from './types'

const cat = (over: Partial<CategoryResult>): CategoryResult => ({
  id: 'x',
  label: 'X',
  description: '',
  risk: 'safe',
  totalSizeBytes: 0,
  items: [],
  matchedItemCount: 0,
  missing: false,
  permissionDenied: false,
  ...over
})

describe('stepResultFromCategory', () => {
  it('reports found with a size', () => {
    expect(stepResultFromCategory(cat({ totalSizeBytes: 5 }))).toMatchObject({
      state: 'found',
      sizeBytes: 5,
      partial: false
    })
  })

  it('keeps denied, missing and empty apart', () => {
    expect(stepResultFromCategory(cat({ permissionDenied: true, missing: true })).state).toBe(
      'denied'
    )
    expect(stepResultFromCategory(cat({ missing: true })).state).toBe('missing')
    expect(stepResultFromCategory(cat({})).state).toBe('empty')
  })

  it('marks a found category with some refusals as partial', () => {
    expect(
      stepResultFromCategory(cat({ totalSizeBytes: 9, permissionDenied: true }))
    ).toMatchObject({ state: 'found', partial: true })
  })
})
