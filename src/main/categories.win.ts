import { join } from 'path'
import type { CategoryDef } from '../shared/types'

/**
 * Windows scan targets. Same risk language as macOS:
 *  safe = the tool rebuilds it, caution = skim first, review = could be your own files.
 * Built from explicit folders (no globs), so a category only ever lists what is named here.
 */
export function windowsCategoryDefs(env: {
  home: string
  localAppData: string
  tmp: string
}): CategoryDef[] {
  const h = (...p: string[]): string => join(env.home, ...p)
  const l = (...p: string[]): string => join(env.localAppData, ...p)
  const chromium = (...vendor: string[]): string[] => [
    l(...vendor, 'User Data', 'Default', 'Cache'),
    l(...vendor, 'User Data', 'Default', 'Code Cache')
  ]
  return [
    {
      id: 'user-caches',
      label: 'App Caches',
      description: 'Internet cache and shader caches Windows apps rebuild automatically.',
      risk: 'safe',
      paths: [l('Microsoft', 'Windows', 'INetCache'), l('D3DSCache')]
    },
    {
      id: 'npm-cache',
      label: 'npm / pnpm / yarn Cache',
      description: 'Package manager download caches. Re-downloaded on demand.',
      risk: 'safe',
      paths: [l('npm-cache'), l('pnpm', 'store'), l('Yarn', 'Cache')]
    },
    {
      id: 'browser-caches',
      label: 'Browser Caches',
      description:
        'Chrome, Edge, Brave and Firefox cache folders. Pages re-cache on visit. Profiles and logins are not listed.',
      risk: 'safe',
      paths: [
        ...chromium('Google', 'Chrome'),
        ...chromium('Microsoft', 'Edge'),
        ...chromium('BraveSoftware', 'Brave-Browser'),
        l('Mozilla', 'Firefox', 'Profiles')
      ]
    },
    {
      id: 'dev-tool-caches',
      label: 'NuGet / Gradle / Cargo / pip',
      description: 'Language package caches. Regenerated on the next build or install.',
      risk: 'safe',
      paths: [
        h('.nuget', 'packages'),
        l('NuGet', 'v3-cache'),
        h('.gradle', 'caches'),
        h('.cargo', 'registry'),
        h('.cargo', 'git'),
        l('pip', 'Cache')
      ]
    },
    {
      id: 'docker-data',
      label: 'Docker Desktop Data',
      description:
        'Docker Desktop WSL disks: images, containers and volumes. Can hold your only copy of data.',
      risk: 'review',
      paths: [l('Docker', 'wsl')]
    },
    {
      id: 'user-temp',
      label: 'Temporary Files',
      description:
        'Per-user temp folder. Items under 2 days old are skipped since apps may be using them.',
      risk: 'safe',
      paths: [env.tmp],
      minAgeDays: 2
    },
    {
      id: 'trash',
      label: 'Recycle Bin',
      description:
        'Files already in the Recycle Bin. Empty it from Sift when you are ready. Permanent.',
      risk: 'caution',
      paths: []
    },
    {
      id: 'logs',
      label: 'Crash dumps and logs',
      description: 'Crash dumps and error reports older than 30 days.',
      risk: 'safe',
      paths: [l('CrashDumps'), l('Microsoft', 'Windows', 'WER')],
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
      id: 'orphaned-dmgs',
      label: 'Old Disk Images',
      description: 'ISO, VHD and IMG files on Desktop and Downloads older than 30 days.',
      risk: 'review',
      paths: [h('Desktop'), h('Downloads')],
      minAgeDays: 30
    },
    {
      id: 'node-modules',
      label: 'Stale project artefacts',
      description:
        'node_modules, build output, Rust target and Python venvs in projects with no file changes for 90+ days. Each row shows the command that restores it.',
      risk: 'caution',
      paths: [],
      minAgeDays: 90
    },
    {
      id: 'large-files',
      label: 'Large & Unused Files',
      description:
        'Files over 200MB across Desktop, Documents and Downloads, untouched for 180+ days.',
      risk: 'review',
      paths: [h('Desktop'), h('Documents'), h('Downloads')],
      minAgeDays: 180
    }
  ]
}
