import { describe, expect, it } from 'vitest'
import { CATEGORY_DEFS } from './categories'

describe('CATEGORY_DEFS', () => {
  it('has unique ids', () => {
    const ids = CATEGORY_DEFS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // These decide how close user data is to the Trash; changing one needs a deliberate edit here.
  it('keeps the agreed risk for AI model and VM stores', () => {
    const risk = (id: string): string | undefined => CATEGORY_DEFS.find((c) => c.id === id)?.risk
    expect(risk('ai-model-caches')).toBe('caution')
    expect(risk('android-system-images')).toBe('caution')
    expect(risk('vm-container-stores')).toBe('review')
  })

  it('gives the new stores paths no other category lists, so space is not counted twice', () => {
    const mine = ['ai-model-caches', 'android-system-images', 'vm-container-stores']
    const others = new Set(
      CATEGORY_DEFS.filter((c) => !mine.includes(c.id)).flatMap((c) => c.paths)
    )
    const clash = CATEGORY_DEFS.filter((c) => mine.includes(c.id)).flatMap((c) =>
      c.paths.filter((p) => others.has(p))
    )
    expect(clash).toEqual([])
  })
})
