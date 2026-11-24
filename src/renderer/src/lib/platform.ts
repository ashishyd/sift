import { trashName } from '@shared/platform'

/** Which OS the app runs on, set once by the preload. */
export const platform = window.api.platform
/** "Trash" on macOS, "Recycle Bin" on Windows. */
export const bin = trashName(platform)
export const modKey = platform === 'mac' ? '⌘' : 'Ctrl+'
export const isMac = platform === 'mac'
