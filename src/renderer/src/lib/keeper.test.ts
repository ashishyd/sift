import { describe, expect, it } from 'vitest'
import { keeperForRule } from './keeper'

const files = [
  '/Users/me/Downloads/IMG_1.MOV',
  '/Users/me/Pictures/IMG_1.MOV',
  '/Users/me/Documents/Old phone/IMG_1.MOV'
]

describe('keeperForRule', () => {
  it('returns nothing when no folder rule is set', () => {
    expect(keeperForRule(files, '')).toBeUndefined()
  })

  it('picks the copy inside the chosen folder', () => {
    expect(keeperForRule(files, 'Pictures')).toBe('/Users/me/Pictures/IMG_1.MOV')
  })

  it('returns nothing when no copy is in the chosen folder', () => {
    expect(keeperForRule(files, 'Desktop')).toBeUndefined()
  })

  it('does not match a folder nested inside another folder', () => {
    const nested = ['/Users/me/Documents/Pictures/a.jpg', '/Users/me/Downloads/a.jpg']
    expect(keeperForRule(nested, 'Pictures')).toBeUndefined()
  })

  it('does not match a folder name that only appears as part of another name', () => {
    const tricky = ['/Users/me/MyPictures/a.jpg', '/Users/me/Pictures/a.jpg']
    expect(keeperForRule(tricky, 'Pictures')).toBe('/Users/me/Pictures/a.jpg')
  })
})
