import { promises as fs } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'
import { run, isPermissionError, isPermissionErrno } from './exec'
import { CATEGORY_DEFS, DEV_SEARCH_ROOTS } from './categories'
import { platform } from './platform'
import {
  dirSizeBytes,
  findDirsByName,
  findFilesByExtension,
  findLargeFiles,
  listWindowsVolumes,
  projectHasRecentFile,
  recycleBinBytes
} from './winScan'
import {
  USER_CACHES_DEDICATED_NAMES,
  computeReclaimableBytes,
  dedupeOverlappingCategoryPaths
} from '../shared/reclaimable'
import { normalizeScanPreferences } from '../shared/preferences'
import {
  ARTIFACT_DIR_NAMES,
  artifactKind,
  isExcludedLocation,
  needsGitIgnore,
  restoreHint
} from '../shared/staleArtifacts'
import type {
  CategoryResult,
  FolderListing,
  ScanItem,
  ScanPreferences,
  ScanSummary
} from '../shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ITEMS_PER_CATEGORY = 200
const MAX_FOLDER_LISTING = 400

/** Coalesce concurrent full scans (tray + UI) onto one in-flight run. */
let inFlightScan: Promise<ScanSummary> | null = null
let cancelRequested = false

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled')
    this.name = 'ScanCancelledError'
  }
}

export function isScanInFlight(): boolean {
  return inFlightScan !== null
}

export function requestScanCancel(): void {
  cancelRequested = true
}

function throwIfCancelled(): void {
  if (cancelRequested) throw new ScanCancelledError()
}

type AccessState = 'ok' | 'denied' | 'missing'

/** Reads a directory macOS only lets Full Disk Access holders list. */
async function hasFullDiskAccess(): Promise<boolean> {
  if (platform === 'win') return false
  for (const probe of ['Library/Safari', 'Library/Mail', 'Library/Messages']) {
    try {
      await fs.readdir(join(homedir(), probe))
      return true
    } catch {
      // ENOENT or EPERM — try the next probe
    }
  }
  return false
}

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
  if (platform === 'win') return dirSizeBytes(p, () => cancelRequested)
  const { stdout, stderr } = await run('du', ['-sk', p])
  const kb = parseInt(stdout.trim().split(/\s+/)[0] ?? '0', 10)
  return {
    bytes: Number.isFinite(kb) ? kb * 1024 : 0,
    denied: isPermissionError(stderr)
  }
}

async function statItem(
  p: string
): Promise<{ mtime: string | null; atime: string | null; size: number; isDir: boolean }> {
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

/** shared/staleArtifacts compares with '/'; Windows paths use backslashes. */
const toPosix = (p: string): string => p.replace(/\\/g, '/')

function olderThanDays(iso: string | null, days: number | undefined): boolean {
  if (!days) return true
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > days * DAY_MS
}

function resolveMinAgeDays(id: string, fallback: number | undefined, prefs: ScanPreferences): number | undefined {
  switch (id) {
    case 'downloads-old':
      return prefs.downloadsMinAgeDays
    case 'logs':
      return prefs.logsMinAgeDays
    case 'messages-attachments':
      return prefs.messagesMinAgeDays
    case 'mail-downloads':
      return prefs.mailMinAgeDays
    case 'xcode-archives':
      return prefs.archivesMinAgeDays
    case 'large-files':
      return prefs.largeFileMinAgeDays
    default:
      return fallback
  }
}

function emptyCategory(
  id: string,
  label: string,
  description: string,
  risk: CategoryResult['risk']
): CategoryResult {
  return {
    id,
    label,
    description,
    risk,
    totalSizeBytes: 0,
    items: [],
    matchedItemCount: 0,
    missing: true,
    permissionDenied: false
  }
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
    throwIfCancelled()
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
      if (name === '.DS_Store' || name === 'desktop.ini') continue
      // Dedicated categories already cover Homebrew/Yarn under ~/Library/Caches.
      if (id === 'user-caches' && USER_CACHES_DEDICATED_NAMES.has(name)) continue
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
  const matchedItemCount = items.length
  const trimmed = items.slice(0, MAX_ITEMS_PER_CATEGORY)
  return {
    id,
    label,
    description,
    risk,
    totalSizeBytes: items.reduce((sum, it) => sum + it.sizeBytes, 0),
    items: trimmed,
    matchedItemCount,
    missing: !anyExists,
    permissionDenied
  }
}

async function projectIsActive(
  project: string,
  minAgeDays: number
): Promise<{ active: boolean; denied: boolean }> {
  if (platform === 'win') return projectHasRecentFile(project, minAgeDays, ARTIFACT_DIR_NAMES)
  // Prune every artefact dir and .git so only the project's own files decide staleness.
  const prune = ARTIFACT_DIR_NAMES.flatMap((n) => ['-name', n, '-o']).concat(['-name', '.git'])
  const { stdout, stderr } = await run('find', [
    project,
    '-maxdepth',
    '4',
    '(',
    ...prune,
    ')',
    '-prune',
    '-o',
    '-type',
    'f',
    '-mtime',
    `-${minAgeDays}`,
    '-print',
    '-quit'
  ])
  return { active: stdout.trim().length > 0, denied: isPermissionError(stderr) }
}

async function scanStaleArtifacts(): Promise<CategoryResult> {
  const def = CATEGORY_DEFS.find((c) => c.id === 'node-modules')!
  // shortcut: fixed 90 days from the category def, no Settings field; add a preference if asked.
  const minAge = def.minAgeDays ?? 90
  const found = new Set<string>()
  let permissionDenied = false

  for (const root of DEV_SEARCH_ROOTS) {
    throwIfCancelled()
    if ((await accessState(root)) !== 'ok') continue
    if (platform === 'win') {
      const hunt = await findDirsByName(root, ARTIFACT_DIR_NAMES, 6, () => cancelRequested)
      if (hunt.denied) permissionDenied = true
      hunt.paths.forEach((p) => found.add(p))
      continue
    }
    const { stdout, stderr } = await run('find', [
      root,
      '-maxdepth',
      '6',
      '-type',
      'd',
      '(',
      '-name',
      'Library',
      ...ARTIFACT_DIR_NAMES.flatMap((n) => ['-o', '-name', n]),
      ')',
      '-prune',
      '-print'
    ])
    if (isPermissionError(stderr)) permissionDenied = true
    stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((p) => p && ARTIFACT_DIR_NAMES.includes(basename(p)))
      .forEach((p) => found.add(p))
  }

  const items: ScanItem[] = []
  for (const dir of found) {
    throwIfCancelled()
    if (isExcludedLocation(toPosix(dir), toPosix(homedir()))) continue
    const project = dirname(dir)
    let parentFiles: string[]
    try {
      parentFiles = await fs.readdir(project)
    } catch (err) {
      if (isPermissionErrno(err)) permissionDenied = true
      continue
    }
    const name = basename(dir)
    if (!artifactKind(name, parentFiles)) continue
    if (name === 'venv' && (await accessState(join(dir, 'pyvenv.cfg'))) !== 'ok') continue
    if (needsGitIgnore(name)) {
      const ignored = await run('git', ['-C', project, 'check-ignore', '-q', dir])
      if (ignored.code !== 0) continue
    }
    const activity = await projectIsActive(project, minAge)
    if (activity.denied) permissionDenied = true
    // Unreadable project = unknown age, so leave it alone rather than guess it is stale.
    if (activity.active || activity.denied) continue

    const st = await statItem(dir)
    const du = await duBytes(dir)
    if (du.denied) permissionDenied = true
    if (du.bytes <= 0) continue
    items.push({
      path: dir,
      name: `${basename(project)}/${name}`,
      sizeBytes: du.bytes,
      isDirectory: true,
      lastAccessed: st.atime,
      lastModified: st.mtime,
      hint: restoreHint(name, parentFiles)
    })
  }
  items.sort((a, b) => b.sizeBytes - a.sizeBytes)
  const matchedItemCount = items.length
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    risk: def.risk,
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items: items.slice(0, MAX_ITEMS_PER_CATEGORY),
    matchedItemCount,
    missing: items.length === 0,
    permissionDenied
  }
}

async function scanLargeFiles(prefs: ScanPreferences): Promise<CategoryResult> {
  const def = CATEGORY_DEFS.find((c) => c.id === 'large-files')!
  const items: ScanItem[] = []
  let permissionDenied = false
  const minAge = resolveMinAgeDays(def.id, def.minAgeDays, prefs) ?? 180
  const sizeKb = `${prefs.largeFileMinMb * 1024}k`

  for (const root of def.paths) {
    throwIfCancelled()
    const state = await accessState(root)
    if (state === 'missing') continue
    if (state === 'denied') {
      permissionDenied = true
      continue
    }
    let files: string[]
    if (platform === 'win') {
      const hunt = await findLargeFiles(
        root,
        prefs.largeFileMinMb * 1024 * 1024,
        minAge,
        () => cancelRequested
      )
      if (hunt.denied) permissionDenied = true
      files = hunt.paths
    } else {
      const { stdout, stderr } = await run('find', [
        root,
        '-type',
        'f',
        '-size',
        `+${sizeKb}`,
        '-mtime',
        `+${minAge}`
      ])
      if (isPermissionError(stderr)) permissionDenied = true
      files = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    }
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
  const matchedItemCount = items.length
  const trimmed = items.slice(0, MAX_ITEMS_PER_CATEGORY)
  return {
    id: def.id,
    label: def.label,
    description: `Files over ${prefs.largeFileMinMb}MB across Desktop, Documents and Downloads, untouched for ${minAge}+ days.`,
    risk: def.risk,
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items: trimmed,
    matchedItemCount,
    missing: items.length === 0,
    permissionDenied
  }
}

async function scanOrphanedDmgs(): Promise<CategoryResult> {
  const def = CATEGORY_DEFS.find((c) => c.id === 'orphaned-dmgs')!
  const items: ScanItem[] = []
  let permissionDenied = false
  const minAge = def.minAgeDays ?? 30
  const extensions = ['*.dmg', '*.iso', '*.pkg']

  for (const root of def.paths) {
    throwIfCancelled()
    const state = await accessState(root)
    if (state === 'missing') continue
    if (state === 'denied') {
      permissionDenied = true
      continue
    }
    for (const pattern of platform === 'win' ? ['windows'] : extensions) {
      let files: string[]
      if (platform === 'win') {
        const hunt = await findFilesByExtension(root, ['.iso', '.vhd', '.vhdx', '.img'], minAge)
        if (hunt.denied) permissionDenied = true
        files = hunt.paths
      } else {
        const { stdout, stderr } = await run('find', [
          root,
          '-maxdepth',
          '3',
          '-type',
          'f',
          '-iname',
          pattern,
          '-mtime',
          `+${minAge}`
        ])
        if (isPermissionError(stderr)) permissionDenied = true
        files = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
      }
      for (const f of files) {
        if (items.some((i) => i.path === f)) continue
        const st = await statItem(f)
        if (st.size <= 0) continue
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
  }

  items.sort((a, b) => b.sizeBytes - a.sizeBytes)
  const matchedItemCount = items.length
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    risk: def.risk,
    totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
    items: items.slice(0, MAX_ITEMS_PER_CATEGORY),
    matchedItemCount,
    missing: items.length === 0,
    permissionDenied
  }
}

/** Parse `df -k` output into local mounted volumes. Exported for tests. */
export function parseDfOutput(stdout: string): Array<{
  device: string
  totalBytes: number
  freeBytes: number
  mountPoint: string
}> {
  const lines = stdout.trim().split('\n').slice(1)
  const volumes: Array<{
    device: string
    totalBytes: number
    freeBytes: number
    mountPoint: string
  }> = []

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue
    const device = parts[0]
    const totalKb = parseInt(parts[1], 10)
    const availKb = parseInt(parts[3], 10)
    const mountPoint = parts.slice(8).join(' ')
    if (!device.startsWith('/dev/')) continue
    if (mountPoint !== '/' && !mountPoint.startsWith('/Volumes/')) continue
    if (!Number.isFinite(totalKb) || totalKb <= 0) continue
    volumes.push({
      device,
      totalBytes: totalKb * 1024,
      freeBytes: Math.max(0, availKb * 1024),
      mountPoint
    })
  }

  const byMount = new Map<string, (typeof volumes)[0]>()
  for (const v of volumes) {
    const prev = byMount.get(v.mountPoint)
    if (!prev || v.totalBytes > prev.totalBytes) byMount.set(v.mountPoint, v)
  }

  return Array.from(byMount.values()).sort((a, b) => {
    if (a.mountPoint === '/') return -1
    if (b.mountPoint === '/') return 1
    return a.mountPoint.localeCompare(b.mountPoint)
  })
}

export async function listVolumes(): Promise<{
  total: number
  free: number
  volumes: Array<{ device: string; totalBytes: number; freeBytes: number; mountPoint: string }>
}> {
  if (platform === 'win') {
    const volumes = await listWindowsVolumes()
    return { total: volumes[0]?.totalBytes ?? 0, free: volumes[0]?.freeBytes ?? 0, volumes }
  }
  const { stdout } = await run('df', ['-k'])
  const volumes = parseDfOutput(stdout)
  const root = volumes.find((v) => v.mountPoint === '/') ?? volumes[0]
  return {
    total: root?.totalBytes ?? 0,
    free: root?.freeBytes ?? 0,
    volumes
  }
}

/** Startup disk only. `df -k /` stays fast where plain `df` can hang on a dead network mount. */
export async function listRootVolume(): Promise<{ total: number; free: number }> {
  if (platform === 'win') {
    const root = (await listWindowsVolumes())[0]
    return { total: root?.totalBytes ?? 0, free: root?.freeBytes ?? 0 }
  }
  const { stdout } = await run('df', ['-k', '/'])
  const root = parseDfOutput(stdout)[0]
  return { total: root?.totalBytes ?? 0, free: root?.freeBytes ?? 0 }
}

/**
 * Downloads/Desktop/Documents/Pictures are macOS per-app TCC-protected folders —
 * the first read triggers the native consent dialog. Scanning those shallow
 * categories before Large Files means any prompt appears while the progress
 * label names the protected folder, not "Large & Unused Files".
 */
const TCC_SENSITIVE_FIRST = ['downloads-old', 'pictures-library']

const SPECIAL_SCAN_IDS = new Set(['node-modules', 'large-files', 'orphaned-dmgs'])

const BUNDLE_SUFFIXES = ['.app', '.photoslibrary', '.framework', '.bundle', '.plugin']

function isOpaqueBundle(name: string): boolean {
  const lower = name.toLowerCase()
  return BUNDLE_SUFFIXES.some((s) => lower.endsWith(s))
}

/** Drop previously-ignored items and recompute each category's total. */
export function applyIgnoredPaths(results: CategoryResult[], ignoredPaths: string[]): CategoryResult[] {
  if (ignoredPaths.length === 0) return results
  const ignored = new Set(ignoredPaths)
  return results.map((c) => {
    const before = c.items.length
    const items = c.items.filter((i) => !ignored.has(i.path))
    const removed = before - items.length
    return {
      ...c,
      items,
      totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
      matchedItemCount: Math.max(0, (c.matchedItemCount ?? before) - removed)
    }
  })
}

/** Lazy size-sorted listing for Explore drill-down. */
export async function listFolder(dirPath: string): Promise<FolderListing> {
  const entries: ScanItem[] = []
  let permissionDenied = false

  let names: string[]
  try {
    names = await fs.readdir(dirPath)
  } catch (err) {
    if (isPermissionErrno(err)) {
      return { path: dirPath, entries: [], permissionDenied: true }
    }
    return { path: dirPath, entries: [], permissionDenied: false }
  }

  for (const name of names) {
    if (name === '.DS_Store' || name.startsWith('.')) continue
    const full = join(dirPath, name)
    const st = await statItem(full)
    let size: number
    const treatAsFile = !st.isDir || isOpaqueBundle(name)
    if (!treatAsFile) {
      const du = await duBytes(full)
      size = du.bytes
      if (du.denied) permissionDenied = true
    } else {
      if (st.isDir) {
        const du = await duBytes(full)
        size = du.bytes
        if (du.denied) permissionDenied = true
      } else {
        size = st.size
      }
    }
    if (size <= 0 && !st.isDir) continue
    entries.push({
      path: full,
      name,
      sizeBytes: size,
      isDirectory: st.isDir && !isOpaqueBundle(name),
      lastAccessed: st.atime,
      lastModified: st.mtime
    })
  }

  entries.sort((a, b) => b.sizeBytes - a.sizeBytes)
  return {
    path: dirPath,
    entries: entries.slice(0, MAX_FOLDER_LISTING),
    permissionDenied
  }
}

/** The Recycle Bin has no readable path, so only its total is known. Items stay unlisted, like a capped Trash. */
async function scanRecycleBin(def: (typeof CATEGORY_DEFS)[number]): Promise<CategoryResult> {
  const bytes = await recycleBinBytes()
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    risk: def.risk,
    totalSizeBytes: bytes,
    items: [],
    matchedItemCount: 0,
    missing: bytes === 0,
    permissionDenied: false
  }
}

async function doFullScan(
  onProgress?: (label: string, done: number, total: number) => void,
  ignoredPaths: string[] = [],
  prefsInput?: ScanPreferences
): Promise<ScanSummary> {
  const prefs = normalizeScanPreferences(prefsInput)
  const disabled = new Set(prefs.disabledCategoryIds)

  const allShallow = CATEGORY_DEFS.filter((c) => !SPECIAL_SCAN_IDS.has(c.id) && !disabled.has(c.id))
  const priorityShallow = allShallow.filter((c) => TCC_SENSITIVE_FIRST.includes(c.id))
  const restShallow = allShallow.filter((c) => !TCC_SENSITIVE_FIRST.includes(c.id))
  const includeLarge = !disabled.has('large-files')
  const includeNode = !disabled.has('node-modules')
  const includeDmgs = !disabled.has('orphaned-dmgs')

  const totalSteps =
    allShallow.length + (includeLarge ? 1 : 0) + (includeNode ? 1 : 0) + (includeDmgs ? 1 : 0)
  let done = 0
  const results: CategoryResult[] = []

  for (const def of [...priorityShallow, ...restShallow]) {
    throwIfCancelled()
    onProgress?.(def.label, done, totalSteps)
    const minAge = resolveMinAgeDays(def.id, def.minAgeDays, prefs)
    if (platform === 'win' && def.id === 'trash') {
      results.push(await scanRecycleBin(def))
      done++
      continue
    }
    results.push(
      await scanShallowCategory(def.id, def.label, def.description, def.risk, def.paths, minAge)
    )
    done++
  }

  if (includeDmgs) {
    throwIfCancelled()
    onProgress?.('Old Disk Images', done, totalSteps)
    results.push(await scanOrphanedDmgs())
    done++
  }

  if (includeLarge) {
    throwIfCancelled()
    onProgress?.('Large & Unused Files', done, totalSteps)
    results.push(await scanLargeFiles(prefs))
    done++
  }

  if (includeNode) {
    throwIfCancelled()
    onProgress?.('Stale project artefacts', done, totalSteps)
    results.push(await scanStaleArtifacts())
    done++
  }

  // Keep disabled categories visible as empty so UI/settings stay consistent.
  for (const def of CATEGORY_DEFS) {
    if (!disabled.has(def.id)) continue
    if (results.some((r) => r.id === def.id)) continue
    results.push(emptyCategory(def.id, def.label, def.description, def.risk))
  }

  // With Full Disk Access, leftover EPERMs come from SIP-protected items, not a missing grant.
  if (await hasFullDiskAccess()) {
    for (const r of results) r.permissionDenied = false
  }

  const deduped = dedupeOverlappingCategoryPaths(results)
  const filtered = applyIgnoredPaths(deduped, ignoredPaths)
  const vol = await listVolumes()

  return {
    scannedAt: new Date().toISOString(),
    volumeTotalBytes: vol.total,
    volumeFreeBytes: vol.free,
    volumes: vol.volumes,
    categories: filtered,
    reclaimableBytes: computeReclaimableBytes(filtered)
  }
}

/**
 * Full disk scan. Concurrent callers share one in-flight run so the tray's
 * background rescan cannot race a user-initiated Dashboard scan.
 */
export async function runFullScan(
  onProgress?: (label: string, done: number, total: number) => void,
  ignoredPaths: string[] = [],
  prefs?: ScanPreferences
): Promise<ScanSummary> {
  if (inFlightScan) return inFlightScan
  cancelRequested = false
  inFlightScan = doFullScan(onProgress, ignoredPaths, prefs)
    .catch((err) => {
      throw err
    })
    .finally(() => {
      inFlightScan = null
      cancelRequested = false
    })
  return inFlightScan
}
