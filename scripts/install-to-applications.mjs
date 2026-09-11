#!/usr/bin/env node
// Finds the .app bundle electron-builder just produced under dist/ and installs it to
// /Applications with `ditto` (preserves resource forks/xattrs, unlike a plain cp -R).
import { execFileSync } from 'child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const DIST_DIR = 'dist'
const DEST_DIR = '/Applications'

function findAppBundle(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry.endsWith('.app')) return full
      const nested = findAppBundle(full)
      if (nested) return nested
    }
  }
  return null
}

if (!existsSync(DIST_DIR)) {
  console.error(`No "${DIST_DIR}" directory — run the build first.`)
  process.exit(1)
}

const appPath = findAppBundle(DIST_DIR)
if (!appPath) {
  console.error(`Couldn't find a .app bundle under "${DIST_DIR}".`)
  process.exit(1)
}

const appName = appPath.split('/').pop()
const dest = join(DEST_DIR, appName)

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true })
}

execFileSync('ditto', [appPath, dest], { stdio: 'inherit' })
console.log(`Installed ${appName} to ${DEST_DIR}`)
