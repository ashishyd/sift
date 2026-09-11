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
  categories: CategoryResult[]
  reclaimableBytes: number
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
