import { create } from 'zustand'
import { computeReclaimableBytes } from '@shared/reclaimable'
import type {
  AccessCheck,
  AiSuggestion,
  ClearHistoryEntry,
  DuplicatesResult,
  FolderListing,
  RiskLevel,
  ScanPreferences,
  ScanSummary
} from '@shared/types'
import { formatBytes } from './lib/format'

interface ScanProgress {
  label: string
  done: number
  total: number
}

interface SiftState {
  summary: ScanSummary | null
  isScanning: boolean
  progress: ScanProgress | null
  scanLog: string[]
  selected: Set<string>
  aiSuggestion: AiSuggestion | null
  isLoadingAi: boolean
  duplicates: DuplicatesResult | null
  isScanningDuplicates: boolean
  hasApiKey: boolean
  hasClaudeCli: boolean
  settingsOpen: boolean
  activeView: 'dashboard' | 'duplicates' | 'explore'
  toast: string | null
  permissions: AccessCheck[] | null
  isCheckingPermissions: boolean
  ignoredPaths: string[] | null
  clearHistory: ClearHistoryEntry[] | null
  aiChat: Array<{ question: string; answer: string }>
  isAskingAi: boolean
  scanPreferences: ScanPreferences | null
  categoryDefs: Array<{ id: string; label: string; risk: RiskLevel }> | null
  folderCache: Record<string, FolderListing>

  setHasApiKey: (v: boolean) => void
  setHasClaudeCli: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setActiveView: (v: 'dashboard' | 'duplicates' | 'explore') => void
  toggleSelected: (path: string) => void
  clearSelected: () => void
  selectAllInCategory: (paths: string[]) => void
  runScan: () => Promise<void>
  cancelScan: () => Promise<void>
  runDuplicateScan: () => Promise<void>
  runAiSuggestion: () => Promise<void>
  trashSelected: () => Promise<void>
  trashPaths: (paths: string[], opts?: { skipConfirm?: boolean }) => Promise<void>
  emptyTrash: () => Promise<void>
  showToast: (msg: string) => void
  refreshPermissions: () => Promise<void>
  openPrivacySettings: (pane: 'files' | 'full-disk-access') => Promise<void>
  ignoreItems: (paths: string[]) => Promise<void>
  unignorePath: (path: string) => Promise<void>
  refreshIgnoredPaths: () => Promise<void>
  refreshClearHistory: () => Promise<void>
  askAi: (question: string) => Promise<void>
  loadCachedSummary: () => Promise<void>
  loadScanPreferences: () => Promise<void>
  saveScanPreferences: (prefs: Partial<ScanPreferences>) => Promise<void>
  loadCategoryDefs: () => Promise<void>
  loadFolder: (path: string) => Promise<FolderListing | null>
}

function pruneDuplicates(
  duplicates: DuplicatesResult | null,
  trashed: Set<string>
): DuplicatesResult | null {
  if (!duplicates) return null
  const groups = duplicates.groups
    .map((g) => ({ ...g, files: g.files.filter((f) => !trashed.has(f)) }))
    .filter((g) => g.files.length > 1)
  return {
    ...duplicates,
    groups,
    reclaimableBytes: groups.reduce((s, g) => s + g.sizeBytes * (g.files.length - 1), 0)
  }
}

export const useSiftStore = create<SiftState>((set, get) => ({
  summary: null,
  isScanning: false,
  progress: null,
  scanLog: [],
  selected: new Set(),
  aiSuggestion: null,
  isLoadingAi: false,
  duplicates: null,
  isScanningDuplicates: false,
  hasApiKey: false,
  hasClaudeCli: false,
  settingsOpen: false,
  activeView: 'dashboard',
  toast: null,
  permissions: null,
  isCheckingPermissions: false,
  ignoredPaths: null,
  clearHistory: null,
  aiChat: [],
  isAskingAi: false,
  scanPreferences: null,
  categoryDefs: null,
  folderCache: {},

  setHasApiKey: (v): void => set({ hasApiKey: v }),
  setHasClaudeCli: (v): void => set({ hasClaudeCli: v }),
  setSettingsOpen: (v): void => set({ settingsOpen: v }),
  setActiveView: (v): void => set({ activeView: v }),

  toggleSelected: (path): void => {
    const next = new Set(get().selected)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ selected: next })
  },

  clearSelected: (): void => set({ selected: new Set() }),

  selectAllInCategory: (paths): void => {
    const next = new Set(get().selected)
    const allSelected = paths.every((p) => next.has(p))
    for (const p of paths) {
      if (allSelected) next.delete(p)
      else next.add(p)
    }
    set({ selected: next })
  },

  runScan: async (): Promise<void> => {
    set({
      isScanning: true,
      progress: null,
      scanLog: [],
      aiSuggestion: null,
      aiChat: [],
      selected: new Set(),
      folderCache: {}
    })
    try {
      const summary = await window.api.scan((p) =>
        set((state) => ({
          progress: p,
          scanLog:
            state.progress && state.progress.label !== p.label
              ? [...state.scanLog, state.progress.label]
              : state.scanLog
        }))
      )
      set({ summary, isScanning: false, progress: null })
    } catch (err) {
      set({ isScanning: false, progress: null })
      const message = err instanceof Error ? err.message : 'Scan failed'
      if (message === 'Scan cancelled' || (err instanceof Error && err.name === 'ScanCancelledError')) {
        get().showToast('Scan cancelled')
        return
      }
      get().showToast(message)
    }
  },

  cancelScan: async (): Promise<void> => {
    if (!get().isScanning) return
    await window.api.cancelScan()
  },

  runDuplicateScan: async (): Promise<void> => {
    set({ isScanningDuplicates: true })
    try {
      const duplicates = await window.api.findDuplicates()
      set({ duplicates, isScanningDuplicates: false })
    } catch (err) {
      set({ isScanningDuplicates: false })
      get().showToast(err instanceof Error ? err.message : 'Duplicate scan failed')
    }
  },

  runAiSuggestion: async (): Promise<void> => {
    const { summary } = get()
    if (!summary) return
    set({ isLoadingAi: true })
    try {
      const aiSuggestion = await window.api.getAiSuggestion(summary)
      set({ aiSuggestion, isLoadingAi: false })
    } catch (err) {
      set({ isLoadingAi: false })
      get().showToast(err instanceof Error ? err.message : 'AI suggestion failed')
    }
  },

  trashSelected: async (): Promise<void> => {
    const paths = Array.from(get().selected)
    await get().trashPaths(paths)
  },

  trashPaths: async (paths, opts): Promise<void> => {
    if (paths.length === 0) return
    const sizeMap = new Map<string, number>()
    const { summary, folderCache } = get()
    summary?.categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
    Object.values(folderCache).forEach((listing) =>
      listing.entries.forEach((i) => sizeMap.set(i.path, i.sizeBytes))
    )
    const totalSize = paths.reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)
    if (!opts?.skipConfirm) {
      const confirmed = await window.api.confirmTrash(paths.length, formatBytes(totalSize))
      if (!confirmed) return
    }
    const result = await window.api.trash(paths)
    if (result.failed.length > 0) {
      const sample = result.failed
        .slice(0, 2)
        .map((f) => `${f.path.split('/').pop()}: ${f.error}`)
        .join(' · ')
      get().showToast(
        `Moved ${result.succeeded.length}, failed ${result.failed.length}${sample ? ` — ${sample}` : ''}`
      )
    } else {
      get().showToast(`Moved ${result.succeeded.length} item(s) to Trash`)
    }

    const trashedSet = new Set(result.succeeded)
    set((state) => {
      const nextFolderCache = { ...state.folderCache }
      for (const [dir, listing] of Object.entries(nextFolderCache)) {
        nextFolderCache[dir] = {
          ...listing,
          entries: listing.entries.filter((e) => !trashedSet.has(e.path))
        }
      }

      if (!state.summary) {
        return {
          duplicates: pruneDuplicates(state.duplicates, trashedSet),
          folderCache: nextFolderCache,
          selected: new Set([...state.selected].filter((p) => !trashedSet.has(p)))
        }
      }

      const categories = state.summary.categories.map((c) => {
        const before = c.items.length
        const items = c.items.filter((i) => !trashedSet.has(i.path))
        const removed = before - items.length
        const removedBytes = c.items
          .filter((i) => trashedSet.has(i.path))
          .reduce((s, i) => s + i.sizeBytes, 0)
        return {
          ...c,
          items,
          totalSizeBytes: Math.max(0, c.totalSizeBytes - removedBytes),
          matchedItemCount: Math.max(0, (c.matchedItemCount ?? before) - removed)
        }
      })
      const nextSelected = new Set(state.selected)
      trashedSet.forEach((p) => nextSelected.delete(p))
      return {
        summary: {
          ...state.summary,
          categories,
          reclaimableBytes: computeReclaimableBytes(categories)
        },
        selected: nextSelected,
        duplicates: pruneDuplicates(state.duplicates, trashedSet),
        folderCache: nextFolderCache
      }
    })
  },

  emptyTrash: async (): Promise<void> => {
    const trash = get().summary?.categories.find((c) => c.id === 'trash')
    const sizeLabel = formatBytes(trash?.totalSizeBytes ?? 0)
    const confirmed = await window.api.confirmEmptyTrash(sizeLabel)
    if (!confirmed) return
    try {
      const result = await window.api.emptyTrash()
      set((state) => {
        if (!state.summary) return {}
        const categories = state.summary.categories.map((c) =>
          c.id === 'trash'
            ? { ...c, items: [], totalSizeBytes: 0, matchedItemCount: 0, missing: false }
            : c
        )
        return {
          summary: {
            ...state.summary,
            categories,
            reclaimableBytes: computeReclaimableBytes(categories)
          }
        }
      })
      get().showToast(`Emptied Trash · freed ${formatBytes(result.freedBytes)}`)
      get().refreshClearHistory()
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not empty Trash')
    }
  },

  showToast: (msg): void => {
    set({ toast: msg })
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null })
    }, 4500)
  },

  refreshPermissions: async (): Promise<void> => {
    set({ isCheckingPermissions: true })
    try {
      const permissions = await window.api.checkPermissions()
      set({ permissions, isCheckingPermissions: false })
    } catch (err) {
      set({ isCheckingPermissions: false })
      get().showToast(err instanceof Error ? err.message : 'Could not check permissions')
    }
  },

  openPrivacySettings: async (pane): Promise<void> => {
    await window.api.openPrivacySettings(pane)
  },

  ignoreItems: async (paths): Promise<void> => {
    if (paths.length === 0) return
    const ignoredPaths = await window.api.ignorePaths(paths)
    const ignoredSet = new Set(paths)
    set((state) => {
      if (!state.summary) return { ignoredPaths }
      const categories = state.summary.categories.map((c) => {
        const before = c.items.length
        const items = c.items.filter((i) => !ignoredSet.has(i.path))
        const removed = before - items.length
        return {
          ...c,
          items,
          totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
          matchedItemCount: Math.max(0, (c.matchedItemCount ?? before) - removed)
        }
      })
      const nextSelected = new Set(state.selected)
      ignoredSet.forEach((p) => nextSelected.delete(p))
      return {
        ignoredPaths,
        summary: {
          ...state.summary,
          categories,
          reclaimableBytes: computeReclaimableBytes(categories)
        },
        selected: nextSelected
      }
    })
    get().showToast(
      paths.length === 1
        ? 'Item ignored — won’t resurface on rescan'
        : `${paths.length} items ignored`
    )
  },

  unignorePath: async (path): Promise<void> => {
    const ignoredPaths = await window.api.unignorePath(path)
    set({ ignoredPaths })
  },

  refreshIgnoredPaths: async (): Promise<void> => {
    const ignoredPaths = await window.api.getIgnoredPaths()
    set({ ignoredPaths })
  },

  refreshClearHistory: async (): Promise<void> => {
    const clearHistory = await window.api.getClearHistory()
    set({ clearHistory })
  },

  askAi: async (question): Promise<void> => {
    const { summary } = get()
    if (!summary || !question.trim()) return
    set({ isAskingAi: true })
    try {
      const answer = await window.api.askAi(summary, question.trim())
      set((state) => ({
        aiChat: [...state.aiChat, { question: question.trim(), answer }],
        isAskingAi: false
      }))
    } catch (err) {
      set({ isAskingAi: false })
      get().showToast(err instanceof Error ? err.message : 'Could not ask Claude')
    }
  },

  loadCachedSummary: async (): Promise<void> => {
    if (get().summary) return
    const cached = await window.api.getLastScanSummary()
    if (cached && !get().summary) set({ summary: cached })
  },

  loadScanPreferences: async (): Promise<void> => {
    const scanPreferences = await window.api.getScanPreferences()
    set({ scanPreferences })
  },

  saveScanPreferences: async (prefs): Promise<void> => {
    const scanPreferences = await window.api.setScanPreferences(prefs)
    set({ scanPreferences })
    get().showToast('Scan settings saved — apply on next scan')
  },

  loadCategoryDefs: async (): Promise<void> => {
    if (get().categoryDefs) return
    const categoryDefs = await window.api.getCategoryDefs()
    set({ categoryDefs })
  },

  loadFolder: async (path): Promise<FolderListing | null> => {
    const cached = get().folderCache[path]
    if (cached) return cached
    try {
      const listing = await window.api.listFolder(path)
      set((state) => ({ folderCache: { ...state.folderCache, [path]: listing } }))
      return listing
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not open folder')
      return null
    }
  }
}))
