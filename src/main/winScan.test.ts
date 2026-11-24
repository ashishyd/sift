import { mkdtemp, mkdir, rm, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  dirSizeBytes,
  findDirsByName,
  findFilesByExtension,
  findLargeFiles,
  parseByteCount,
  projectHasRecentFile,
  volumeFromStatfs
} from './winScan'

let root: string
const DAY = 24 * 60 * 60 * 1000

async function file(rel: string, bytes: number, ageDays = 0): Promise<string> {
  const p = join(root, rel)
  await mkdir(join(p, '..'), { recursive: true })
  await writeFile(p, Buffer.alloc(bytes))
  const t = new Date(Date.now() - ageDays * DAY)
  await utimes(p, t, t)
  return p
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'sift-win-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('dirSizeBytes', () => {
  it('sums nested files', async () => {
    await file('a/one.bin', 100)
    await file('a/b/two.bin', 250)
    expect(await dirSizeBytes(join(root, 'a'))).toEqual({ bytes: 350, denied: false })
  })

  it('returns a single file size and treats a missing path as empty, not denied', async () => {
    const f = await file('x.bin', 40)
    expect((await dirSizeBytes(f)).bytes).toBe(40)
    expect(await dirSizeBytes(join(root, 'nope'))).toEqual({ bytes: 0, denied: false })
  })
})

describe('findLargeFiles', () => {
  it('needs both size and age', async () => {
    const big = await file('big-old.bin', 2000, 400)
    await file('big-new.bin', 2000, 1)
    await file('small-old.bin', 10, 400)
    expect((await findLargeFiles(root, 1000, 180)).paths).toEqual([big])
  })
})

describe('findFilesByExtension', () => {
  it('matches case-insensitively, respects age and depth', async () => {
    const iso = await file('Win.ISO', 5, 60)
    await file('new.iso', 5, 1)
    await file('a/b/c/d/deep.iso', 5, 60)
    await file('notes.txt', 5, 60)
    expect((await findFilesByExtension(root, ['.iso'], 30)).paths).toEqual([iso])
  })
})

describe('findDirsByName', () => {
  it('records artefact dirs without entering them, and skips dot folders', async () => {
    await file('proj/node_modules/pkg/node_modules/x.js', 1)
    await file('.hidden/proj/node_modules/y.js', 1)
    const { paths } = await findDirsByName(root, ['node_modules'], 6)
    expect(paths).toEqual([join(root, 'proj', 'node_modules')])
  })
})

describe('projectHasRecentFile', () => {
  it('ignores artefact dirs and .git when judging activity', async () => {
    await file('p/src/old.ts', 1, 200)
    await file('p/node_modules/new.js', 1, 0)
    await file('p/.git/HEAD', 1, 0)
    expect((await projectHasRecentFile(join(root, 'p'), 90, ['node_modules'])).active).toBe(false)
    await file('p/src/fresh.ts', 1, 1)
    expect((await projectHasRecentFile(join(root, 'p'), 90, ['node_modules'])).active).toBe(true)
  })
})

describe('parseByteCount', () => {
  it('reads PowerShell numbers and treats junk or empty as 0', () => {
    expect(parseByteCount('1048576\r\n')).toBe(1048576)
    expect(parseByteCount('')).toBe(0)
    expect(parseByteCount('Cannot find path')).toBe(0)
  })
})

describe('volumeFromStatfs', () => {
  it('builds a drive row and rejects empty drives', () => {
    expect(volumeFromStatfs('C', { bsize: 4096, blocks: 1000, bavail: 250 })).toEqual({
      device: 'C:',
      totalBytes: 4096000,
      freeBytes: 1024000,
      mountPoint: 'C:\\'
    })
    expect(volumeFromStatfs('D', { bsize: 4096, blocks: 0, bavail: 0 })).toBeNull()
  })
})
