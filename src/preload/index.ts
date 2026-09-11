import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AccessCheck,
  AiSuggestion,
  ClearHistoryEntry,
  DuplicatesResult,
  ScanSummary,
  TrashResult
} from '../shared/types'

type PrivacyPane = 'files' | 'full-disk-access'

const api = {
  scan: (onProgress: (p: { label: string; done: number; total: number }) => void): Promise<ScanSummary> => {
    const listener = (_event: unknown, payload: { label: string; done: number; total: number }): void =>
      onProgress(payload)
    ipcRenderer.on('sift:scan-progress', listener)
    return ipcRenderer.invoke('sift:scan').finally(() => {
      ipcRenderer.removeListener('sift:scan-progress', listener)
    })
  },
  findDuplicates: (): Promise<DuplicatesResult> => ipcRenderer.invoke('sift:findDuplicates'),
  trash: (paths: string[]): Promise<TrashResult> => ipcRenderer.invoke('sift:trash', paths),
  revealInFinder: (path: string): Promise<void> => ipcRenderer.invoke('sift:revealInFinder', path),
  getAiSuggestion: (summary: ScanSummary): Promise<AiSuggestion> =>
    ipcRenderer.invoke('sift:getAiSuggestion', summary),
  askAi: (summary: ScanSummary, question: string): Promise<string> =>
    ipcRenderer.invoke('sift:askAi', summary, question),
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('sift:hasApiKey'),
  hasClaudeCli: (): Promise<boolean> => ipcRenderer.invoke('sift:hasClaudeCli'),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('sift:setApiKey', key),
  clearApiKey: (): Promise<void> => ipcRenderer.invoke('sift:clearApiKey'),
  confirmTrash: (count: number, sizeLabel: string): Promise<boolean> =>
    ipcRenderer.invoke('sift:confirmTrash', count, sizeLabel),
  checkPermissions: (): Promise<AccessCheck[]> => ipcRenderer.invoke('sift:checkPermissions'),
  openPrivacySettings: (pane: PrivacyPane): Promise<void> =>
    ipcRenderer.invoke('sift:openPrivacySettings', pane),
  getLastScanSummary: (): Promise<ScanSummary | null> => ipcRenderer.invoke('sift:getLastScanSummary'),
  getIgnoredPaths: (): Promise<string[]> => ipcRenderer.invoke('sift:getIgnoredPaths'),
  ignorePaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('sift:ignorePaths', paths),
  unignorePath: (path: string): Promise<string[]> => ipcRenderer.invoke('sift:unignorePath', path),
  getClearHistory: (): Promise<ClearHistoryEntry[]> => ipcRenderer.invoke('sift:getClearHistory')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type SiftApi = typeof api
