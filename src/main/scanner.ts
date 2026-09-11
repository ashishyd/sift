import { promises as fs } from 'fs'
import { basename, join } from 'path'
import { run, isPermissionError, isPermissionErrno } from './exec'
import { CATEGORY_DEFS, DEV_SEARCH_ROOTS } from './categories'
import type { CategoryResult, ScanItem, ScanSummary } from '../shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ITEMS_PER_CATEGORY = 200

type AccessState = 'ok' | 'denied' | 'missing'

async function accessState(p: string): Promise<AccessState> {
  try {
    await fs.stat(p)
    return 'ok'
  } catch (err) {
    if (isPermissionErrno(err)) return 'denied'
    return 'missing'
  }
}

/** Size (bytes) of a file or directory via `du`, which is much faster than a JS walk. */
async function duBytes(p: string): Promise<{ bytes: number; denied: boolean }> {
  const { stdout, stderr } = await run('du', ['-sk', p])
  const kb = parseInt(stdout.trim().split(/\s+/)[0] ?? '0', 10)
  return {
    bytes: Number.isFinite(kb) ? kb * 1024 : 0,
    denied: isPermissionError(stderr)
  }
}

async function statItem(p: string): Promise<{ mtime: string | null; atime: string | null; size: number; isDir: boolean }> {
  try {
    const st = await fs.stat(p)
    return {
      mtime: st.mtime.toISOString(),
      atime: st.atime.toISOString(),
      size: st.size,
      isDir: st.isDirectory()
    }
  } catch {
    return { mtime: null, atime: null, size: 0, isDir: false }
  }
}

function olderThanDays(iso: string | null, days: number | undefined): boolean {
  if (!days) return true
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > days * DAY_MS
}

/** Scan a first-level-listing category (App Caches, npm cache, Downloads, ...). */
async function scanShallowCategory(
  id: string,
  label: string,
  description: string,
  risk: CategoryResult['risk'],
  paths: string[],
  minAgeDays?: number
): Promise<CategoryResult> {
  const items: ScanItem[] = []
  let anyExists = false
  let permissionDenied = false

  for (const root of paths) {
    const state = await accessState(root)
    if (state === 'missing') continue
    anyExists = true
    if (state === 'denied') {
      permissionDenied = true
      continue
    }

    let entries: string[]
    try {
      entries = await fs.readdir(root)
    } catch (err) {
      if (isPermissionErrno(err)) permissionDenied = true
      continue
    }
    for (const name of entries) {
      if (name === '.DS_Store') continue
      const full = join(root, name)
      const st = await statItem(full)
      const refDate = st.mtime ?? st.atime
      if (!olderThanDays(refDate, minAgeDays)) continue
      let size: number
      if (st.isDir) {
        const du = await duBytes(full)
        size = du.bytes
        if (du.denied) permissionDenied = true
      } else {
        size = st.size
      }
      if (size <= 0) continue
      items.push({
        path: full,
        name,
        sizeBytes: size,
        isDirectory: st.isDir,
        lastAccessed: st.atime,
        lastModified: st.mtime
      })
    }
  }

  items.sort((a, b) => b.sizeBytes - a.sizeBytes)
  const trimmed = items.slice(0, MAX_ITEMS_PER_CATEGORY)
  return {
    id,
    label,
    description,
    risk,
    totalSizeBytes: items.reduce((sum, it) => sum + it.sizeBytes, 0),
    items: trimmed,
    missing: !anyExists,
    permissionDenied
  }
}

async function scanNodeModules(): Promise<CategoryResult> {
  const def = CATEGORY_DEFS.find((c) => c.id === 'node-modules')!
  const found = new Set<string>()
  let permissionDenied = false

  for (const root of DEV_SEARCH_ROOTS) {
    if ((await accessState(root)) !== 'ok') continue
    const { stdout, stderr } = await run('find', [
      root,
      '-maxdepth',
      '6',
      '-type',
      'd',
      '-name',
      'node_modules',
      '-prune'
    ])
    if (isPermissionError(stderr)) permissionDenied = true
    stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((p) => found.add(p))
  }

  const items: ScanItem[] = []
  for (const dir of found) {
    const st = await statItem(dir)
    const du = await duBytes(dir)
    if (du.denied) permissionDenied = true
    if (du.bytes <= 0) continue
    items.push({
      path: dir,
      name: `${basename(dir.replace(/\/node_modules$/, ''))}/node_modules`,
      sizeBytes: du.bytes,
      isDirectory: true,
      lastAccessed: st.atime,
      lastModified: st.mtime
    })
  }
  items.sort((a, b) => b.sizeBytes - a.sizeBytes)
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    risk: def.risk,
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items: items.slice(0, MAX_ITEMS_PER_CATEGORY),
    missing: items.length === 0,
    permissionDenied
  }
}

async function scanLargeFiles(): Promise<CategoryResult> {
  const def = CATEGORY_DEFS.find((c) => c.id === 'large-files')!
  const items: ScanItem[] = []
  let permissionDenied = false

  for (const root of def.paths) {
    const state = await accessState(root)
    if (state === 'missing') continue
    if (state === 'denied') {
      permissionDenied = true
      continue
    }
    const { stdout, stderr } = await run('find', [
      root,
      '-type',
      'f',
      '-size',
      '+204800k',
      '-mtime',
      `+${def.minAgeDays ?? 180}`
    ])
    if (isPermissionError(stderr)) permissionDenied = true
    const files = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const f of files.slice(0, MAX_ITEMS_PER_CATEGORY)) {
      const st = await statItem(f)
      items.push({
        path: f,
        name: basename(f),
        sizeBytes: st.size,
        isDirectory: false,
        lastAccessed: st.atime,
        lastModified: st.mtime
      })
    }
  }

  items.sort((a, b) => b.sizeBytes - a.sizeBytes)
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    risk: def.risk,
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items: items.slice(0, MAX_ITEMS_PER_CATEGORY),
    missing: items.length === 0,
    permissionDenied
  }
}

async function volumeUsage(): Promise<{ total: number; free: number }> {
  const { stdout } = await run('df', ['-k', '/'])
  try {
    const line = stdout.trim().split('\n')[1]
    const parts = line.trim().split(/\s+/)
    const totalKb = parseInt(parts[1], 10)
    const availKb = parseInt(parts[3], 10)
    return { total: totalKb * 1024, free: availKb * 1024 }
  } catch {
    return { total: 0, free: 0 }
  }
}

/**
 * Downloads/Desktop/Documents are macOS's per-app "protected folder" TCC categories — the
 * first read attempt triggers the native consent dialog. Scanning them first (instead of,
 * say, buried in the middle of the Library caches loop) means any prompt shows up while the
 * progress label plainly says "Old Downloads" or "Large & Unused Files", not mid-cache-scan.
 */
const TCC_SENSITIVE_FIRST = ['downloads-old', 'pictures-library']

/** Drop previously-ignored items and recompute each category's total. */
export function applyIgnoredPaths(results: CategoryResult[], ignoredPaths: string[]): CategoryResult[] {
  if (ignoredPaths.length === 0) return results
  const ignored = new Set(ignoredPaths)
  return results.map((c) => {
    const items = c.items.filter((i) => !ignored.has(i.path))
    return { ...c, items, totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0) }
  })
}

export async function runFullScan(
  onProgress?: (label: string, done: number, total: number) => void,
  ignoredPaths: string[] = []
): Promise<ScanSummary> {
  const allShallow = CATEGORY_DEFS.filter((c) => c.id !== 'node-modules' && c.id !== 'large-files')
  const priorityShallow = allShallow.filter((c) => TCC_SENSITIVE_FIRST.includes(c.id))
  const restShallow = allShallow.filter((c) => !TCC_SENSITIVE_FIRST.includes(c.id))

  const totalSteps = allShallow.length + 2
  let done = 0
  const results: CategoryResult[] = []

  onProgress?.('Large & Unused Files', done, totalSteps)
  results.push(await scanLargeFiles())
  done++

  for (const def of [...priorityShallow, ...restShallow]) {
    onProgress?.(def.label, done, totalSteps)
    results.push(
      await scanShallowCategory(def.id, def.label, def.description, def.risk, def.paths, def.minAgeDays)
    )
    done++
  }

  onProgress?.('Stray node_modules', done, totalSteps)
  results.push(await scanNodeModules())
  done++

  const filtered = applyIgnoredPaths(results, ignoredPaths)
  const vol = await volumeUsage()
  const reclaimable = filtered
    .filter((r) => r.id !== 'trash')
    .reduce((s, r) => s + r.totalSizeBytes, 0)

  return {
    scannedAt: new Date().toISOString(),
    volumeTotalBytes: vol.total,
    volumeFreeBytes: vol.free,
    categories: filtered,
    reclaimableBytes: reclaimable
  }
}
