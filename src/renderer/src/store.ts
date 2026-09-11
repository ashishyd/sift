import { create } from 'zustand'
import type { AccessCheck, AiSuggestion, ClearHistoryEntry, DuplicatesResult, ScanSummary } from '@shared/types'
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

  setHasApiKey: (v: boolean) => void
  setHasClaudeCli: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setActiveView: (v: 'dashboard' | 'duplicates' | 'explore') => void
  toggleSelected: (path: string) => void
  clearSelected: () => void
  selectAllInCategory: (paths: string[]) => void
  runScan: () => Promise<void>
  runDuplicateScan: () => Promise<void>
  runAiSuggestion: () => Promise<void>
  trashSelected: () => Promise<void>
  trashPaths: (paths: string[]) => Promise<void>
  showToast: (msg: string) => void
  refreshPermissions: () => Promise<void>
  openPrivacySettings: (pane: 'files' | 'full-disk-access') => Promise<void>
  ignoreItems: (paths: string[]) => Promise<void>
  unignorePath: (path: string) => Promise<void>
  refreshIgnoredPaths: () => Promise<void>
  refreshClearHistory: () => Promise<void>
  askAi: (question: string) => Promise<void>
  loadCachedSummary: () => Promise<void>
}

export const useSiftStore = create<SiftState>((set, get) => ({
  summary: null,
  isScanning: false,
  progress: null,
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
    set({ isScanning: true, progress: null, aiSuggestion: null, aiChat: [], selected: new Set() })
    try {
      const summary = await window.api.scan((p) => set({ progress: p }))
      set({ summary, isScanning: false, progress: null })
    } catch (err) {
      set({ isScanning: false, progress: null })
      get().showToast(err instanceof Error ? err.message : 'Scan failed')
    }
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

  trashPaths: async (paths): Promise<void> => {
    if (paths.length === 0) return
    const sizeMap = new Map<string, number>()
    const { summary } = get()
    summary?.categories.forEach((c) => c.items.forEach((i) => sizeMap.set(i.path, i.sizeBytes)))
    const totalSize = paths.reduce((s, p) => s + (sizeMap.get(p) ?? 0), 0)
    const confirmed = await window.api.confirmTrash(paths.length, formatBytes(totalSize))
    if (!confirmed) return

    const result = await window.api.trash(paths)
    if (result.failed.length > 0) {
      get().showToast(`Moved ${result.succeeded.length}, failed ${result.failed.length}`)
    } else {
      get().showToast(`Moved ${result.succeeded.length} item(s) to Trash`)
    }

    const trashedSet = new Set(result.succeeded)
    set((state) => {
      if (!state.summary) return {}
      const categories = state.summary.categories.map((c) => ({
        ...c,
        items: c.items.filter((i) => !trashedSet.has(i.path)),
        totalSizeBytes: c.items
          .filter((i) => !trashedSet.has(i.path))
          .reduce((s, i) => s + i.sizeBytes, 0)
      }))
      const reclaimableBytes = categories
        .filter((c) => c.id !== 'trash')
        .reduce((s, c) => s + c.totalSizeBytes, 0)
      const nextSelected = new Set(state.selected)
      trashedSet.forEach((p) => nextSelected.delete(p))
      return {
        summary: { ...state.summary, categories, reclaimableBytes },
        selected: nextSelected
      }
    })
  },

  showToast: (msg): void => {
    set({ toast: msg })
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null })
    }, 4000)
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
        const items = c.items.filter((i) => !ignoredSet.has(i.path))
        return { ...c, items, totalSizeBytes: items.reduce((s, i) => s + i.sizeBytes, 0) }
      })
      const reclaimableBytes = categories
        .filter((c) => c.id !== 'trash')
        .reduce((s, c) => s + c.totalSizeBytes, 0)
      const nextSelected = new Set(state.selected)
      ignoredSet.forEach((p) => nextSelected.delete(p))
      return {
        ignoredPaths,
        summary: { ...state.summary, categories, reclaimableBytes },
        selected: nextSelected
      }
    })
    get().showToast(paths.length === 1 ? 'Item ignored — won’t resurface on rescan' : `${paths.length} items ignored`)
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
      set((state) => ({ aiChat: [...state.aiChat, { question: question.trim(), answer }], isAskingAi: false }))
    } catch (err) {
      set({ isAskingAi: false })
      get().showToast(err instanceof Error ? err.message : 'Could not ask Claude')
    }
  },

  loadCachedSummary: async (): Promise<void> => {
    if (get().summary) return
    const cached = await window.api.getLastScanSummary()
    if (cached && !get().summary) set({ summary: cached })
  }
}))
