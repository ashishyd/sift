import { promises as fs, type Stats } from 'fs'
import { join } from 'path'
import { isPermissionErrno, run } from './exec'

const DAY_MS = 24 * 60 * 60 * 1000

export interface WalkOptions {
  /** Directory levels below the root to visit (root's children are depth 1). */
  maxDepth: number
  /** Return true to not descend into this directory. */
  pruneDir?: (name: string) => boolean
  /** Return true to stop the whole walk. */
  onFile?: (path: string, st: Stats) => boolean | void
  /** Called for each directory; return true to record it and not descend. */
  onDir?: (path: string, name: string) => boolean | void
  shouldStop?: () => boolean
}

/** Node walk standing in for `find`/`du` on Windows. Never follows links. Reports refusals, never throws. */
export async function walk(root: string, opts: WalkOptions): Promise<{ denied: boolean }> {
  let denied = false
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (stack.length > 0) {
    if (opts.shouldStop?.()) break
    const { dir, depth } = stack.pop()!
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (err) {
      if (isPermissionErrno(err)) denied = true
      continue
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (opts.onDir?.(full, entry.name)) continue
        if (depth + 1 < opts.maxDepth && !opts.pruneDir?.(entry.name)) {
          stack.push({ dir: full, depth: depth + 1 })
        }
      } else if (entry.isFile() && opts.onFile) {
        let st: Stats
        try {
          st = await fs.lstat(full)
        } catch (err) {
          if (isPermissionErrno(err)) denied = true
          continue
        }
        if (opts.onFile(full, st) === true) return { denied }
      }
    }
  }
  return { denied }
}

/** Total bytes under a file or folder (stands in for `du -sk`). */
export async function dirSizeBytes(
  p: string,
  shouldStop?: () => boolean
): Promise<{ bytes: number; denied: boolean }> {
  let bytes = 0
  try {
    const st = await fs.lstat(p)
    if (!st.isDirectory()) return { bytes: st.size, denied: false }
  } catch (err) {
    return { bytes: 0, denied: isPermissionErrno(err) }
  }
  const { denied } = await walk(p, {
    maxDepth: Number.MAX_SAFE_INTEGER,
    shouldStop,
    onFile: (_path, st) => {
      bytes += st.size
    }
  })
  return { bytes, denied }
}

const isOld = (st: Stats, days: number): boolean => Date.now() - st.mtimeMs > days * DAY_MS

export async function findLargeFiles(
  root: string,
  minBytes: number,
  minAgeDays: number,
  shouldStop?: () => boolean
): Promise<{ paths: string[]; denied: boolean }> {
  const paths: string[] = []
  const { denied } = await walk(root, {
    maxDepth: Number.MAX_SAFE_INTEGER,
    shouldStop,
    onFile: (p, st) => {
      if (st.size > minBytes && isOld(st, minAgeDays)) paths.push(p)
    }
  })
  return { paths, denied }
}

export async function findFilesByExtension(
  root: string,
  extensions: string[],
  minAgeDays: number,
  maxDepth = 3
): Promise<{ paths: string[]; denied: boolean }> {
  const paths: string[] = []
  const lower = extensions.map((e) => e.toLowerCase())
  const { denied } = await walk(root, {
    maxDepth,
    onFile: (p, st) => {
      if (lower.some((e) => p.toLowerCase().endsWith(e)) && isOld(st, minAgeDays)) paths.push(p)
    }
  })
  return { paths, denied }
}

/** Folders never worth walking when hunting for project artefacts. */
const SKIP_WHEN_HUNTING = new Set([
  'AppData',
  'Windows',
  'Program Files',
  'Program Files (x86)',
  '$Recycle.Bin',
  'System Volume Information'
])

/** Dev-folder hunt for names like node_modules; found folders are recorded, not entered. */
export async function findDirsByName(
  root: string,
  names: string[],
  maxDepth: number,
  shouldStop?: () => boolean
): Promise<{ paths: string[]; denied: boolean }> {
  const paths: string[] = []
  const { denied } = await walk(root, {
    maxDepth,
    shouldStop,
    pruneDir: (n) => n.startsWith('.') || SKIP_WHEN_HUNTING.has(n),
    onDir: (p, n) => {
      if (!names.includes(n)) return false
      paths.push(p)
      return true
    }
  })
  return { paths, denied }
}

/** True if any project file (outside artefact dirs and .git) changed within `days`. */
export async function projectHasRecentFile(
  project: string,
  days: number,
  pruneNames: string[]
): Promise<{ active: boolean; denied: boolean }> {
  let active = false
  const { denied } = await walk(project, {
    maxDepth: 4,
    pruneDir: (n) => n === '.git' || pruneNames.includes(n),
    onFile: (_p, st) => {
      if (!isOld(st, days)) {
        active = true
        return true
      }
      return false
    }
  })
  return { active, denied }
}

/** Parse the PowerShell number printed for the Recycle Bin size. Empty or junk means 0. */
export function parseByteCount(stdout: string): number {
  const n = Number(stdout.trim())
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** The Recycle Bin is a shell folder, not a path, so ask Explorer's own COM view for its size. */
export async function recycleBinBytes(): Promise<number> {
  const script =
    '(New-Object -ComObject Shell.Application).NameSpace(10).Items() | ForEach-Object { $_.Size } | Measure-Object -Sum | Select-Object -ExpandProperty Sum'
  const { stdout } = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script
  ])
  return parseByteCount(stdout)
}

export async function emptyRecycleBin(): Promise<{ stderr: string; code: number | null }> {
  const { stderr, code } = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Clear-RecycleBin -Force -ErrorAction Stop'
  ])
  return { stderr, code }
}

export interface WinVolume {
  device: string
  totalBytes: number
  freeBytes: number
  mountPoint: string
}

/** Build a volume row from fs.statfs numbers. Exported for tests. */
export function volumeFromStatfs(
  letter: string,
  st: { bsize: number; blocks: number; bavail: number }
): WinVolume | null {
  const total = st.bsize * st.blocks
  if (!(total > 0)) return null
  return {
    device: `${letter}:`,
    totalBytes: total,
    freeBytes: Math.max(0, st.bsize * st.bavail),
    mountPoint: `${letter}:\\`
  }
}

/** Every drive letter that answers, system drive first. */
export async function listWindowsVolumes(): Promise<WinVolume[]> {
  const system = (process.env.SystemDrive ?? 'C:').charAt(0).toUpperCase()
  const letters = [system, ...'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((l) => l !== system)]
  const found = await Promise.all(
    letters.map(async (letter) => {
      try {
        return volumeFromStatfs(letter, await fs.statfs(`${letter}:\\`))
      } catch {
        return null
      }
    })
  )
  return found.filter((v): v is WinVolume => v !== null)
}
