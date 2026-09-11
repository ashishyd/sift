import { createHash } from 'crypto'
import { createReadStream, promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { isPermissionErrno } from './exec'
import type { DuplicateGroup, DuplicatesResult } from '../shared/types'

const home = homedir()
const SEARCH_ROOTS = [join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Downloads'), join(home, 'Pictures')]
const SKIP_DIRS = new Set(['node_modules', '.git', 'Library', '.Trash'])
const MAX_FILES_WALKED = 25000
const MAX_FILE_SIZE_TO_HASH = 500 * 1024 * 1024 // 500MB
const MAX_DEPTH = 8

async function walk(
  root: string,
  depth: number,
  out: Array<{ path: string; size: number }>,
  denied: { value: boolean }
): Promise<void> {
  if (out.length >= MAX_FILES_WALKED || depth > MAX_DEPTH) return
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch (err) {
    if (isPermissionErrno(err)) denied.value = true
    return
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES_WALKED) return
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      await walk(full, depth + 1, out, denied)
    } else if (entry.isFile()) {
      try {
        const st = await fs.stat(full)
        if (st.size > 0) out.push({ path: full, size: st.size })
      } catch {
        // unreadable file, skip
      }
    }
  }
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export async function findDuplicates(): Promise<DuplicatesResult> {
  const files: Array<{ path: string; size: number }> = []
  const denied = { value: false }
  for (const root of SEARCH_ROOTS) {
    await walk(root, 0, files, denied)
  }

  const bySize = new Map<number, string[]>()
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE_TO_HASH) continue
    const list = bySize.get(f.size) ?? []
    list.push(f.path)
    bySize.set(f.size, list)
  }

  const groups: DuplicateGroup[] = []
  for (const [size, paths] of bySize) {
    if (paths.length < 2) continue
    const byHash = new Map<string, string[]>()
    for (const p of paths) {
      try {
        const hash = await hashFile(p)
        const list = byHash.get(hash) ?? []
        list.push(p)
        byHash.set(hash, list)
      } catch {
        // unreadable file, skip
      }
    }
    for (const [hash, matched] of byHash) {
      if (matched.length > 1) {
        groups.push({ sizeBytes: size, hash, files: matched })
      }
    }
  }

  groups.sort((a, b) => b.sizeBytes * (b.files.length - 1) - a.sizeBytes * (a.files.length - 1))

  const reclaimable = groups.reduce((sum, g) => sum + g.sizeBytes * (g.files.length - 1), 0)

  return {
    scannedAt: new Date().toISOString(),
    groups: groups.slice(0, 200),
    reclaimableBytes: reclaimable,
    permissionDenied: denied.value
  }
}
