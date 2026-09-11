import { ElectronAPI } from '@electron-toolkit/preload'
import type { SiftApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: SiftApi
  }
}
