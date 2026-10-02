import { shell } from 'electron'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { run } from './exec'
import type { TrashResult } from '../shared/types'

/** Moves paths to the macOS Trash (Finder-recoverable) — never a permanent delete. */
export async function moveToTrash(paths: string[]): Promise<TrashResult> {
  const succeeded: string[] = []
  const failed: Array<{ path: string; error: string }> = []
  let freedBytes = 0

  for (const p of paths) {
    try {
      const size = await sizeOf(p)
      await shell.trashItem(p)
      succeeded.push(p)
      freedBytes += size
    } catch (err) {
      failed.push({ path: p, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { succeeded, failed, freedBytes }
}

/** Permanently empties the Finder Trash via AppleScript. */
export async function emptyTrash(): Promise<{ freedBytes: number }> {
  const trashPath = join(homedir(), '.Trash')
  let freedBytes = 0
  try {
    freedBytes = await sizeOf(trashPath)
  } catch {
    freedBytes = 0
  }

  const { stderr } = await run('osascript', ['-e', 'tell application "Finder" to empty trash'])
  if (stderr && /error/i.test(stderr)) {
    throw new Error(stderr.trim() || 'Could not empty Trash')
  }

  return { freedBytes }
}

async function sizeOf(p: string): Promise<number> {
  try {
    const st = await fs.stat(p)
    if (!st.isDirectory()) return st.size
    let total = 0
    const entries = await fs.readdir(p, { withFileTypes: true })
    for (const entry of entries) {
      total += await sizeOf(`${p}/${entry.name}`)
    }
    return total
  } catch {
    return 0
  }
}
