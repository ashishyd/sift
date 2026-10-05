export type RiskLevel = 'safe' | 'caution' | 'review'

export interface CategoryDef {
  id: string
  label: string
  description: string
  risk: RiskLevel
  /** Paths are resolved against the user's home directory or are absolute. */
  paths: string[]
  /** Only count files/subitems older than this many days (mtime or atime). */
  minAgeDays?: number
}

export interface ScanItem {
  path: string
  name: string
  sizeBytes: number
  isDirectory: boolean
  lastAccessed: string | null
  lastModified: string | null
}

export interface CategoryResult {
  id: string
  label: string
  description: string
  risk: RiskLevel
  totalSizeBytes: number
  items: ScanItem[]
  /** Total matches before the per-category list cap (may exceed items.length). */
  matchedItemCount: number
  missing: boolean
  /** true if scanning hit an EPERM/EACCES (TCC privacy) error — results may be incomplete. */
  permissionDenied: boolean
}

export type PermissionStatus = 'granted' | 'denied'

export interface AccessCheck {
  id: string
  label: string
  path: string
  status: PermissionStatus
}

export interface ScanSummary {
  scannedAt: string
  volumeTotalBytes: number
  volumeFreeBytes: number
  /** Mounted local volumes (APFS/HFS+/exFAT etc.), root first. */
  volumes: VolumeInfo[]
  categories: CategoryResult[]
  reclaimableBytes: number
}

export interface VolumeInfo {
  mountPoint: string
  /** Device identifier from df, e.g. /dev/disk3s1 */
  device: string
  totalBytes: number
  freeBytes: number
}

export interface DuplicateGroup {
  sizeBytes: number
  hash: string
  files: string[]
}

export interface DuplicatesResult {
  scannedAt: string
  groups: DuplicateGroup[]
  reclaimableBytes: number
  permissionDenied: boolean
}

export interface AiSuggestion {
  summary: string
  recommendations: Array<{
    categoryId: string
    verdict: 'clear-it' | 'review-first' | 'keep'
    reason: string
  }>
  /** 'claude' = Anthropic API key; 'claude-cli' = the user's local, already-logged-in Claude Code CLI; 'local' = offline heuristic. */
  source: 'claude' | 'claude-cli' | 'local'
  /** Set only when source is 'local' because a configured Claude call failed — not set when there's simply no key. */
  errorReason?: string
}

export interface TrashResult {
  succeeded: string[]
  failed: Array<{ path: string; error: string }>
  freedBytes: number
}

export interface AppSettings {
  hasApiKey: boolean
}

export interface ClearHistoryEntry {
  date: string
  count: number
  freedBytes: number
}

/** User-tunable scan / tray preferences persisted in config.json. */
export interface ScanPreferences {
  largeFileMinMb: number
  largeFileMinAgeDays: number
  downloadsMinAgeDays: number
  logsMinAgeDays: number
  messagesMinAgeDays: number
  mailMinAgeDays: number
  archivesMinAgeDays: number
  backgroundScanHours: number
  lowSpaceAlertsEnabled: boolean
  /** Alert when free space on the startup disk drops below this many GB. */
  lowSpaceThresholdGb: number
  disabledCategoryIds: string[]
}

export interface FolderListing {
  path: string
  entries: ScanItem[]
  permissionDenied: boolean
}

/** One folder/file a desktop AI app keeps on disk (cache, logs, history, VM images...). */
export interface AiAppComponent {
  id: string
  label: string
  description: string
  path: string
  sizeBytes: number
  risk: RiskLevel
  /** true = regenerable (cache/logs/downloads); false = chats, settings or login state. */
  clearable: boolean
}

export interface AiAppUsage {
  id: string
  label: string
  /** Whether the app (or its helpers) is running right now — clearing while open may fail or be rebuilt immediately. */
  running: boolean
  runningProcessName: string | null
  totalBytes: number
  /** Sum of components flagged clearable. */
  clearableBytes: number
  components: AiAppComponent[]
}

export interface AiAppsReport {
  scannedAt: string
  apps: AiAppUsage[]
  totalBytes: number
  clearableBytes: number
}

/** A running app and the memory it holds (large footprints drive swap, which a restart empties). */
export interface MemoryHog {
  name: string
  pids: number[]
  rssBytes: number
}

/** A file that was deleted but is still open, so its disk space has not been released. */
export interface HeldDeletedFile {
  pid: number
  processName: string
  path: string
  sizeBytes: number
}

export interface HiddenSpaceReport {
  scannedAt: string
  swapUsedBytes: number
  swapTotalBytes: number
  /** Size of /private/var/vm/sleepimage (rewritten on every sleep; not removable). */
  sleepImageBytes: number
  /** Time Machine local snapshots on the startup disk, newest first (date stamps like 2026-10-05-101500). */
  snapshots: string[]
  heldDeleted: HeldDeletedFile[]
  heldDeletedBytes: number
  memoryHogs: MemoryHog[]
}
