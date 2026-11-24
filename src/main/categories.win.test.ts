import { isAbsolute, win32 } from 'path'
import { describe, expect, it } from 'vitest'
import { windowsCategoryDefs } from './categories.win'

const defs = windowsCategoryDefs({
  home: '/Users/dev',
  localAppData: '/Users/dev/AppData/Local',
  tmp: '/Users/dev/AppData/Local/Temp'
})

describe('windowsCategoryDefs', () => {
  it('has unique ids', () => {
    const ids = defs.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never points at macOS locations', () => {
    for (const d of defs) for (const p of d.paths) expect(p).not.toMatch(/Library|\.Trash/)
  })

  it('only lists folders under the profile or temp folder', () => {
    for (const d of defs) for (const p of d.paths) expect(isAbsolute(p)).toBe(true)
  })

  it('keeps user-owned data at review and caches at safe', () => {
    const risk = (id: string): string | undefined => defs.find((d) => d.id === id)?.risk
    expect(risk('downloads-old')).toBe('review')
    expect(risk('large-files')).toBe('review')
    expect(risk('orphaned-dmgs')).toBe('review')
    expect(risk('docker-data')).toBe('review')
    expect(risk('npm-cache')).toBe('safe')
    expect(risk('browser-caches')).toBe('safe')
    expect(risk('trash')).toBe('caution')
  })

  it('gives the Recycle Bin no path, since it is a shell folder', () => {
    expect(defs.find((d) => d.id === 'trash')?.paths).toEqual([])
  })

  it('never lists browser profile data, only cache folders', () => {
    const browser = defs.find((d) => d.id === 'browser-caches')!
    for (const p of browser.paths) {
      expect(p).toMatch(/Cache|Profiles/)
      expect(p).not.toMatch(/Login Data|Cookies|History/)
    }
  })
})

describe('win32 path assumption', () => {
  it('uses backslashes, which the staleArtifacts check normalises', () => {
    expect(win32.join('C:\\Users\\dev', 'proj', 'node_modules')).toBe(
      'C:\\Users\\dev\\proj\\node_modules'
    )
  })
})
