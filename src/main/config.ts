import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ClearHistoryEntry, ScanSummary } from '../shared/types'

const MAX_HISTORY_ENTRIES = 100

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

interface StoredConfig {
  encryptedApiKey?: string // base64
  ignoredPaths?: string[]
  clearHistory?: ClearHistoryEntry[]
}

async function readConfig(): Promise<StoredConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeConfig(cfg: StoredConfig): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(configPath(), JSON.stringify(cfg), 'utf-8')
}

async function patchConfig(patch: Partial<StoredConfig>): Promise<void> {
  const cfg = await readConfig()
  await writeConfig({ ...cfg, ...patch })
}

export async function getApiKey(): Promise<string | null> {
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) return envKey

  const cfg = await readConfig()
  if (!cfg.encryptedApiKey) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(cfg.encryptedApiKey, 'base64'))
  } catch {
    return null
  }
}

export async function setApiKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable on this system.')
  }
  const encrypted = safeStorage.encryptString(key)
  await patchConfig({ encryptedApiKey: encrypted.toString('base64') })
}

export async function clearApiKey(): Promise<void> {
  await patchConfig({ encryptedApiKey: undefined })
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null
}

export async function getIgnoredPaths(): Promise<string[]> {
  const cfg = await readConfig()
  return cfg.ignoredPaths ?? []
}

export async function ignorePaths(paths: string[]): Promise<string[]> {
  const current = new Set(await getIgnoredPaths())
  paths.forEach((p) => current.add(p))
  const next = Array.from(current)
  await patchConfig({ ignoredPaths: next })
  return next
}

export async function unignorePath(path: string): Promise<string[]> {
  const current = (await getIgnoredPaths()).filter((p) => p !== path)
  await patchConfig({ ignoredPaths: current })
  return current
}

export async function getClearHistory(): Promise<ClearHistoryEntry[]> {
  const cfg = await readConfig()
  return cfg.clearHistory ?? []
}

export async function appendClearHistory(entry: ClearHistoryEntry): Promise<void> {
  const history = await getClearHistory()
  const next = [entry, ...history].slice(0, MAX_HISTORY_ENTRIES)
  await patchConfig({ clearHistory: next })
}

function lastScanPath(): string {
  return join(app.getPath('userData'), 'last-scan.json')
}

export async function saveLastScan(summary: ScanSummary): Promise<void> {
  try {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(lastScanPath(), JSON.stringify(summary), 'utf-8')
  } catch {
    // cache is best-effort
  }
}

export async function loadLastScan(): Promise<ScanSummary | null> {
  try {
    return JSON.parse(await fs.readFile(lastScanPath(), 'utf-8')) as ScanSummary
  } catch {
    return null
  }
}

/** Drops removed paths from the cached scan so a relaunch doesn't show items that are gone. */
export async function pruneLastScan(removed: string[]): Promise<void> {
  const summary = await loadLastScan()
  if (!summary) return
  const gone = new Set(removed)
  const categories = summary.categories.map((c) => {
    const items = c.items.filter((i) => !gone.has(i.path))
    return { ...c, items, totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0) }
  })
  const reclaimableBytes = categories
    .filter((c) => c.id !== 'trash')
    .reduce((s, c) => s + c.totalSizeBytes, 0)
  await saveLastScan({ ...summary, categories, reclaimableBytes })
}
