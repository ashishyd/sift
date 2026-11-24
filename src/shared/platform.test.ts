import { describe, expect, it } from 'vitest'
import { detectPlatform, trashName } from './platform'

describe('detectPlatform', () => {
  it('maps Node platform names to a scanner family', () => {
    expect(detectPlatform('darwin')).toBe('mac')
    expect(detectPlatform('win32')).toBe('win')
    expect(detectPlatform('linux')).toBe('other')
  })
})

describe('trashName', () => {
  it('uses the wording of the OS', () => {
    expect(trashName('mac')).toBe('Trash')
    expect(trashName('win')).toBe('Recycle Bin')
  })
})
