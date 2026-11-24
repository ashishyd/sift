import { detectPlatform } from '../shared/platform'

/** Fixed for the life of the process; the scanner and categories are chosen from it once. */
export const platform = detectPlatform(process.platform)
