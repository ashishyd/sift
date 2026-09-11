import { homedir } from 'os'
import { join } from 'path'
import type { CategoryDef } from '../shared/types'

const home = homedir()
const h = (...parts: string[]): string => join(home, ...parts)

/**
 * Known, well-understood macOS/dev-tool locations that are generally safe to
 * regenerate or already-processed by the OS. Risk levels:
 *  - safe: OS/tool regenerates this automatically, near-zero chance of data loss
 *  - caution: usually fine, but skim the list before clearing
 *  - review: could contain user data (old downloads, big files) — look first
 */
export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'user-caches',
    label: 'App Caches',
    description: 'Per-app cache data in ~/Library/Caches. Apps rebuild these automatically.',
    risk: 'safe',
    paths: [h('Library', 'Caches')]
  },
  {
    id: 'xcode-derived-data',
    label: 'Xcode DerivedData',
    description: 'Build intermediates Xcode regenerates on the next build.',
    risk: 'safe',
    paths: [h('Library', 'Developer', 'Xcode', 'DerivedData')]
  },
  {
    id: 'xcode-archives',
    label: 'Xcode Archives',
    description: 'Old app archives from past builds/exports. Keep any you may need to re-submit.',
    risk: 'review',
    paths: [h('Library', 'Developer', 'Xcode', 'Archives')],
    minAgeDays: 90
  },
  {
    id: 'ios-device-support',
    label: 'iOS DeviceSupport',
    description: 'Debug symbols for old iOS versions you no longer test against.',
    risk: 'caution',
    paths: [h('Library', 'Developer', 'Xcode', 'iOS DeviceSupport')]
  },
  {
    id: 'simulator-caches',
    label: 'iOS Simulator Caches',
    description: 'CoreSimulator cache data, not simulator devices themselves.',
    risk: 'safe',
    paths: [h('Library', 'Developer', 'CoreSimulator', 'Caches')]
  },
  {
    id: 'npm-cache',
    label: 'npm / pnpm / yarn Cache',
    description: 'Package manager download caches. Re-downloaded on demand.',
    risk: 'safe',
    paths: [
      h('.npm', '_cacache'),
      h('Library', 'pnpm', 'store'),
      h('.local', 'share', 'pnpm', 'store'),
      h('Library', 'Caches', 'Yarn')
    ]
  },
  {
    id: 'homebrew-cache',
    label: 'Homebrew Cache',
    description: 'Downloaded bottles/formula archives Homebrew keeps after install.',
    risk: 'safe',
    paths: [h('Library', 'Caches', 'Homebrew')]
  },
  {
    id: 'docker-data',
    label: 'Docker Desktop Data',
    description: 'Docker Desktop VM disk image — images/containers you no longer use.',
    risk: 'review',
    paths: [h('Library', 'Containers', 'com.docker.docker', 'Data', 'vms')]
  },
  {
    id: 'trash',
    label: 'Trash',
    description: "Files already in Trash, waiting to be emptied. Sift won't empty this for you.",
    risk: 'caution',
    paths: [h('.Trash')]
  },
  {
    id: 'logs',
    label: 'Log Files',
    description: 'Diagnostic and crash logs older than 30 days.',
    risk: 'safe',
    paths: [h('Library', 'Logs'), h('Library', 'Application Support', 'CrashReporter')],
    minAgeDays: 30
  },
  {
    id: 'downloads-old',
    label: 'Old Downloads',
    description: 'Files in Downloads untouched for 90+ days.',
    risk: 'review',
    paths: [h('Downloads')],
    minAgeDays: 90
  },
  {
    id: 'ios-backups',
    label: 'iOS Device Backups',
    description:
      'Full iPhone/iPad backups made via Finder. Check Finder > device management before deleting — this may be your only backup of a device.',
    risk: 'review',
    paths: [h('Library', 'Application Support', 'MobileSync', 'Backup')]
  },
  {
    id: 'mail-downloads',
    label: 'Mail Downloads',
    description:
      'Cached email attachments. Mail re-downloads these from IMAP servers on demand; POP or local-only accounts may lose access to old ones.',
    risk: 'caution',
    paths: [h('Library', 'Containers', 'com.apple.mail', 'Data', 'Library', 'Mail Downloads')],
    minAgeDays: 30
  },
  {
    id: 'messages-attachments',
    label: 'Messages Attachments',
    description:
      'Photos, videos and files sent or received in Messages. This is real content people sent you — review before clearing.',
    risk: 'review',
    paths: [h('Library', 'Messages', 'Attachments')],
    minAgeDays: 180
  },
  {
    id: 'pictures-library',
    label: 'Pictures & Photos Library',
    description:
      "Shown for visibility — your Photos Library and anything else directly in Pictures. Sift won't reach inside the library package.",
    risk: 'review',
    paths: [h('Pictures')]
  },
  {
    id: 'node-modules',
    label: 'Stray node_modules',
    description: 'node_modules folders in your dev directories — reinstallable with a package manager.',
    risk: 'review',
    paths: []
  },
  {
    id: 'large-files',
    label: 'Large & Unused Files',
    description: 'Files over 200MB across Desktop, Documents and Downloads, untouched for 180+ days.',
    risk: 'review',
    paths: [h('Desktop'), h('Documents'), h('Downloads')],
    minAgeDays: 180
  }
]

export const DEV_SEARCH_ROOTS = [h('Desktop'), h('Documents'), h('Developer'), h('Projects'), h('dev'), home]
