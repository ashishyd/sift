/** Which scanner and wording the app uses. Pure so main, preload and the renderer can share it. */
export type Platform = 'mac' | 'win' | 'other'

/** Map a Node `process.platform` value to the scanner family. Anything else gets no scanner. */
export function detectPlatform(nodePlatform: string): Platform {
  if (nodePlatform === 'darwin') return 'mac'
  if (nodePlatform === 'win32') return 'win'
  return 'other'
}

/** What the OS calls the place recoverable deletes go. */
export function trashName(platform: Platform): string {
  return platform === 'win' ? 'Recycle Bin' : 'Trash'
}
