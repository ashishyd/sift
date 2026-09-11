import { shell } from 'electron'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { isPermissionErrno } from './exec'
import type { AccessCheck } from '../shared/types'

const home = homedir()

/** macOS's three TCC-protected "special" folders — reading them for the first time triggers a native consent dialog. */
const CHECKED_FOLDERS: Array<{ id: string; label: string; path: string }> = [
  { id: 'downloads', label: 'Downloads', path: join(home, 'Downloads') },
  { id: 'desktop', label: 'Desktop', path: join(home, 'Desktop') },
  { id: 'documents', label: 'Documents', path: join(home, 'Documents') },
  { id: 'pictures', label: 'Pictures', path: join(home, 'Pictures') }
]

/** Attempting the readdir IS what triggers macOS's native permission prompt the first time. */
export async function checkAllPermissions(): Promise<AccessCheck[]> {
  return Promise.all(
    CHECKED_FOLDERS.map(async ({ id, label, path }) => {
      try {
        await fs.readdir(path)
        return { id, label, path, status: 'granted' as const }
      } catch (err) {
        return { id, label, path, status: isPermissionErrno(err) ? ('denied' as const) : ('granted' as const) }
      }
    })
  )
}

export type PrivacyPane = 'files' | 'full-disk-access'

export async function openPrivacySettings(pane: PrivacyPane): Promise<void> {
  const url =
    pane === 'full-disk-access'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
  await shell.openExternal(url)
}
