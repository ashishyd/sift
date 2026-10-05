import { dialog } from 'electron'
import { promises as fs } from 'fs'
import { userInfo } from 'os'
import { run } from './exec'
import type { HeldDeletedFile, HiddenSpaceReport, MemoryHog, SimulatorRuntime } from '../shared/types'

const MIN_HELD_BYTES = 10 * 1024 * 1024
const MIN_HOG_BYTES = 400 * 1024 * 1024
const RUNTIME_ID = /^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/i
const PLATFORM_NAMES: Record<string, string> = {
  iphonesimulator: 'iOS',
  appletvsimulator: 'tvOS',
  watchsimulator: 'watchOS',
  xrsimulator: 'visionOS'
}
const SNAPSHOT_DATE = /^\d{4}-\d{2}-\d{2}-\d{6}$/

/** `sysctl -n vm.swapusage` → "total = 2048.00M  used = 1014.31M  free = 1033.69M  (encrypted)" */
export function parseSwapUsage(out: string): { totalBytes: number; usedBytes: number } {
  const unit = (v: string, u: string): number =>
    parseFloat(v) * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[u] ?? 1)
  const total = out.match(/total\s*=\s*([\d.]+)([KMG])/)
  const used = out.match(/used\s*=\s*([\d.]+)([KMG])/)
  return {
    totalBytes: total ? unit(total[1], total[2]) : 0,
    usedBytes: used ? unit(used[1], used[2]) : 0
  }
}

/** `tmutil listlocalsnapshots /` → date stamps, newest first. */
export function parseSnapshots(out: string): string[] {
  return out
    .split('\n')
    .map((l) => l.match(/com\.apple\.TimeMachine\.(\d{4}-\d{2}-\d{2}-\d{6})/)?.[1])
    .filter((d): d is string => !!d)
    .sort()
    .reverse()
}

/**
 * Parse `lsof -nP -F pcsn +L1` output (field mode: p=pid, c=command, s=size, n=name).
 * `+L1` lists open files whose link count is 0, i.e. deleted but still held open.
 */
export function parseHeldDeleted(out: string): HeldDeletedFile[] {
  const files: HeldDeletedFile[] = []
  let pid = 0
  let processName = ''
  let size = 0
  for (const line of out.split('\n')) {
    const tag = line[0]
    const val = line.slice(1)
    if (tag === 'p') pid = parseInt(val, 10)
    else if (tag === 'c') processName = val
    else if (tag === 's') size = parseInt(val, 10) || 0
    else if (tag === 'n') {
      // Mapped system caches show up here too but are shared and tiny/unowned; the size floor drops them.
      if (size >= MIN_HELD_BYTES && pid > 0) {
        files.push({ pid, processName, path: val.replace(/ \(deleted\)$/, ''), sizeBytes: size })
      }
      size = 0
    }
  }
  // The same file is listed once per descriptor — keep one row per pid+path.
  const seen = new Set<string>()
  return files
    .filter((f) => {
      const key = `${f.pid}:${f.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
}

/** `ps -axo pid=,rss=,comm=` → one row per .app bundle, summed across helper processes. */
export function parseMemoryHogs(out: string): MemoryHog[] {
  const byApp = new Map<string, MemoryHog>()
  for (const line of out.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (!m) continue
    const app = m[3].match(/\/([^/]+)\.app\//)
    if (!app) continue
    const name = app[1]
    const entry = byApp.get(name) ?? { name, pids: [], rssBytes: 0 }
    entry.pids.push(parseInt(m[1], 10))
    entry.rssBytes += parseInt(m[2], 10) * 1024
    byApp.set(name, entry)
  }
  return Array.from(byApp.values())
    .filter((h) => h.rssBytes >= MIN_HOG_BYTES)
    .sort((a, b) => b.rssBytes - a.rssBytes)
    .slice(0, 8)
}

/** `xcrun simctl runtime list -j` → installed simulator runtimes, largest first. */
export function parseSimulatorRuntimes(json: string): SimulatorRuntime[] {
  let data: Record<string, Record<string, unknown>>
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  return Object.values(data)
    .filter((r) => typeof r.identifier === 'string' && typeof r.sizeBytes === 'number')
    .map((r) => {
      const platform = String(r.platformIdentifier ?? '').split('.').pop() ?? ''
      return {
        id: r.identifier as string,
        name: `${PLATFORM_NAMES[platform] ?? 'Simulator'} ${r.version ?? ''}`.trim(),
        sizeBytes: r.sizeBytes as number,
        lastUsedAt: typeof r.lastUsedAt === 'string' ? r.lastUsedAt : null,
        deletable: r.deletable === true
      }
    })
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
}

async function sleepImageBytes(): Promise<number> {
  try {
    return (await fs.stat('/private/var/vm/sleepimage')).size
  } catch {
    return 0
  }
}

export async function scanHiddenSpace(): Promise<HiddenSpaceReport> {
  const uid = String(userInfo().uid)
  const [swap, snaps, lsof, ps, sleep, runtimes] = await Promise.all([
    run('sysctl', ['-n', 'vm.swapusage']),
    run('tmutil', ['listlocalsnapshots', '/']),
    // Own processes only: other users' files can't be freed from here.
    run('lsof', ['-nP', '-u', uid, '-F', 'pcsn', '+L1'], { maxBuffer: 1024 * 1024 * 64 }),
    run('ps', ['-axo', 'pid=,rss=,comm=']),
    sleepImageBytes(),
    run('xcrun', ['simctl', 'runtime', 'list', '-j'])
  ])
  const { totalBytes, usedBytes } = parseSwapUsage(swap.stdout)
  const heldDeleted = parseHeldDeleted(lsof.stdout)
  return {
    scannedAt: new Date().toISOString(),
    swapUsedBytes: usedBytes,
    swapTotalBytes: totalBytes,
    sleepImageBytes: sleep,
    snapshots: parseSnapshots(snaps.stdout),
    heldDeleted,
    heldDeletedBytes: heldDeleted.reduce((s, f) => s + f.sizeBytes, 0),
    memoryHogs: parseMemoryHogs(ps.stdout),
    simulatorRuntimes: parseSimulatorRuntimes(runtimes.stdout)
  }
}

/** Gracefully quits a running app (lets it save state) — frees held files and memory without a reboot. */
export async function quitApp(name: string): Promise<void> {
  if (!/^[\w .+-]+$/.test(name)) throw new Error('Invalid app name')
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Quit app', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Quit ${name}?`,
    detail: 'Unsaved work in the app may be lost. Sift asks the app to quit normally.'
  })
  if (response !== 0) throw new Error('Cancelled')
  const { code, stderr } = await run('osascript', ['-e', `tell application "${name}" to quit`])
  if (code !== 0) throw new Error(stderr.trim() || `Could not quit ${name}`)
}

/** Deletes Time Machine local snapshots (needs admin rights — macOS shows its own password prompt). */
export async function deleteSnapshots(dates: string[]): Promise<number> {
  const valid = dates.filter((d) => SNAPSHOT_DATE.test(d))
  if (valid.length === 0) return 0
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Delete snapshots', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Delete ${valid.length} local Time Machine snapshot(s)?`,
    detail:
      'These are on-disk restore points macOS keeps between backups. Your backups on the Time Machine drive are not affected. macOS will ask for your password.'
  })
  if (response !== 0) throw new Error('Cancelled')
  const script = valid.map((d) => `tmutil deletelocalsnapshots ${d}`).join('; ')
  const { code, stderr } = await run('osascript', [
    '-e',
    `do shell script "${script}" with administrator privileges`
  ])
  if (code !== 0) throw new Error(stderr.trim() || 'Could not delete snapshots')
  return valid.length
}

/** Permanently removes a simulator runtime. Xcode can download it again later. */
export async function deleteSimulatorRuntime(id: string, name: string): Promise<void> {
  if (!RUNTIME_ID.test(id)) throw new Error('Invalid runtime id')
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Delete runtime', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Delete the ${name} simulator runtime?`,
    detail:
      'This is permanent, not a move to Trash. Simulators for this platform stop working until you re-download the runtime in Xcode > Settings > Components.'
  })
  if (response !== 0) throw new Error('Cancelled')
  const { code, stderr } = await run('xcrun', ['simctl', 'runtime', 'delete', id])
  if (code !== 0) throw new Error(stderr.trim() || `Could not delete ${name}`)
}
