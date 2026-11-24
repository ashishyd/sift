import { describe, expect, it } from 'vitest'
import { pickWindowsClaudePath } from './claudeCli'

describe('pickWindowsClaudePath', () => {
  it('takes the real .exe when where.exe lists several shims', () => {
    const out = [
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\claude',
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd',
      'C:\\Users\\dev\\.local\\bin\\claude.exe',
      ''
    ].join('\r\n')
    expect(pickWindowsClaudePath(out)).toBe('C:\\Users\\dev\\.local\\bin\\claude.exe')
  })

  it('refuses a .cmd shim, which would need a shell', () => {
    expect(pickWindowsClaudePath('C:\\npm\\claude.cmd\r\n')).toBeNull()
  })

  it('returns null for the "could not find" message or nothing', () => {
    expect(pickWindowsClaudePath('INFO: Could not find files for the given pattern(s).')).toBeNull()
    expect(pickWindowsClaudePath('')).toBeNull()
  })
})
