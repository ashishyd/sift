<p align="center">
  <img src="build/icon-1024.png" alt="Sift app icon" width="128" height="128">
</p>

<h1 align="center">Sift</h1>

<p align="center"><strong>Know before you clear.</strong></p>

<p align="center">
  AI-assisted storage cleanup for macOS, built for developers.<br>
  See what is filling your disk, what is safe to remove, and how much space you will actually get back.
</p>

<p align="center">
  <img alt="Platform: macOS" src="https://img.shields.io/badge/platform-macOS-lightgrey">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Built with Electron" src="https://img.shields.io/badge/built%20with-Electron-47848f">
</p>

---

Sift scans the places a Mac and its dev tools quietly fill up: app caches, Xcode
build artifacts, package manager caches, AI app data, old downloads, iOS
backups, duplicate files and more. It ranks what is safe to clear against what
needs a second look, and tells you the real space you will recover.

Most cleanups go through the macOS Trash, so they are recoverable until you
empty it yourself. The few actions that are permanent are called out in
[Privacy & safety](#privacy--safety) and always ask first.

## Features

### Find and clear space

- **Top actions.** A single ranked list on the Dashboard, sorted by space freed
  and how confident Sift is that it is safe, so you do not have to hunt through
  categories for the biggest win.
- **Risk labels.** Every category is marked `safe`, `caution` or `review`, so you
  know before you clear.
- **Explore.** Drill into categories and folders with size-sorted children,
  checkboxes and indent guides.
- **Duplicate finder.** Finds exact-content duplicates in Desktop, Documents,
  Downloads and Pictures. Pick which copy to keep and trash the rest.
- **Ignore list.** Mark an item as ignored and it will not come back on the next
  scan. Manage the list from Settings.
- **Clear history.** Every clear is logged with date, item count and bytes
  freed, plus a running lifetime total in Settings.

### Get space back without restarting your Mac

A restart often frees gigabytes. The **Restart space** tab shows where that
space is hiding and lets you reclaim it without rebooting:

- **Deleted files still held open.** Space that emptying the Trash does not free
  until the app holding the file quits. Quit that app right from Sift.
- **Memory swap.** See how much swap is on disk and which apps use the most
  memory, with a Quit button for each.
- **Simulator runtimes.** List installed iOS and tvOS simulator runtimes with
  size and last-used date, and delete the ones you no longer test on.
- **Time Machine local snapshots.** See and delete on-disk restore points.
- **Temporary files.** The per-user temp folder is scanned as its own category.

### Track your AI apps

The **AI Apps** tab shows how much disk space Claude, Cursor and ChatGPT/Codex
use, split into caches, logs, VM images, downloaded builds and history. Each
item is marked clearable or "keep", so caches and VM images can go while chat
history, extensions and login state stay safe. Sift warns you when an app is
running and can quit it before you clear.

### Stay ahead of low disk space

- **Low-space alerts.** Get a macOS notification when free space on your startup
  disk drops below a limit you choose (20 GB by default). Clicking it opens Sift.
  Alerts do not repeat while you hover near the limit, and remind you at most
  once a day if you stay low. Configure or turn off in Settings.
- **Menu bar companion.** A menu bar item shows reclaimable space at a glance,
  rescans in the background every few hours, and lets you scan or quit without
  opening the window.
- **Light on memory in the background.** Closing the window fully closes its
  renderer process and hides the Dock icon, so Sift sits in the menu bar using
  very little memory until you reopen it.

### AI recommendations

- **Plain-English verdicts.** Claude turns a scan into `clear it`, `review first`
  or `keep` advice per category, and you can ask follow-up questions about a
  specific file or category.
- **No API key required.** Use your own Anthropic API key, or your local, already
  logged-in [Claude Code](https://claude.com/claude-code) CLI. Sift detects it
  automatically.
- **Works fully offline.** Without Claude, Sift falls back to a transparent
  rule-based summary and tells you so.

### Permission-aware scanning

Sift knows the difference between "this folder is empty" and "I could not read
this folder", and tells you which. Settings has a live Folder Access panel with
one-click links to the right System Settings pane for both per-folder access and
Full Disk Access.

## Install

Sift is not yet distributed as a signed download, so you build it from source.
It takes a few minutes.

**Requirements:** macOS, [Node.js](https://nodejs.org) 22+ and
[pnpm](https://pnpm.io) 10+.

```bash
git clone https://github.com/ashishyd/sift.git
cd sift
pnpm install
pnpm dist:mac
```

`pnpm dist:mac` builds the app and installs **Sift.app** into `/Applications`.

Because the build is not notarized, macOS may warn that it cannot verify the
developer the first time you open it. Right-click Sift in Applications, choose
**Open**, then confirm.

### First run

1. Open Sift and click **Scan my Mac**.
2. When macOS asks for access to Downloads, Desktop, Documents or Pictures,
   click Allow. Sift tells you which folder it is requesting as it scans.
3. For the most complete results, grant **Full Disk Access** in System
   Settings > Privacy & Security. Sift links straight there if anything was
   unreadable.
4. Optional: open Settings to add an Anthropic API key, set your low-space alert
   threshold, and tune scan rules.

## What Sift checks

App caches, browser caches (Chrome, Firefox, Safari, Edge, Arc, Brave), Xcode
DerivedData, Archives and iOS DeviceSupport, Simulator caches and runtimes,
npm/pnpm/yarn, Gradle/Cargo/pip/CocoaPods, Homebrew cache, Docker Desktop data,
Trash, log files, temporary files, old Downloads, old disk images (DMG/ISO/PKG),
iOS device backups, Mail downloads, Messages attachments, Pictures and Photos
Library, stray `node_modules`, large and unused files, AI app data (Claude,
Cursor, ChatGPT/Codex), and Time Machine local snapshots.

Thresholds such as file age and size are adjustable in Settings, and any
category can be switched off.

## How it works

- **Local heuristics** scan well-known cache, build and download locations using
  `du`, `find` and file metadata. This works offline and is always on.
- **Claude** (optional) writes the summary and per-category verdicts. Only
  category labels, sizes, item counts and a few example filenames are sent,
  never file contents. Sift tries, in order:
  1. An Anthropic API key from Settings, encrypted at rest with macOS Keychain
     (`safeStorage`).
  2. Your local Claude Code CLI, if installed and logged in.
- Every AI response is labeled with its source (Claude API, local Claude CLI, or
  offline heuristic), so you always know what produced it.

## Permissions

macOS gates read access to Downloads, Desktop, Documents and Pictures per app,
and gates broader locations (other apps' caches, Mail, Messages, iOS backups)
behind Full Disk Access. Sift scans the per-folder locations first so any system
dialog appears with context. If a category is incomplete because of a denial,
the Dashboard shows a banner naming it and linking to the right setting. Sift
never just shows "0 items" and lets you assume that means clean.

Notifications for low-space alerts need to be allowed for Sift in System
Settings > Notifications.

## Privacy & safety

- **Trash first.** Clearing files uses the macOS Trash (`shell.trashItem`), so
  you can restore them until you empty it.
- **Permanent actions are separate and confirmed.** Emptying the Trash, deleting
  a simulator runtime, and deleting Time Machine local snapshots cannot be
  undone from Sift, and each asks first. Simulator runtimes can be re-downloaded
  from Xcode, and Time Machine backups on your backup drive are not affected.
- **Every clear is confirmed** with a native dialog showing the item count and
  size before anything moves.
- **Quitting apps is graceful.** Sift asks an app to quit normally and confirms
  first. Unsaved work in that app can still be lost.
- **No file contents leave your Mac.** The optional Claude integration sends
  category-level metadata only. Your API key goes only to Anthropic's API, and
  the CLI path stays inside your own authenticated `claude` session.
- **Nothing runs in the cloud.** Scanning, hashing and cleanup all happen
  locally.

## Development

```bash
pnpm install
pnpm dev          # run the app with hot reload
```

```bash
pnpm typecheck    # tsc, main + renderer
pnpm lint         # eslint
pnpm test         # vitest unit tests
pnpm build        # typecheck + production bundle
pnpm dist:mac     # build, package, and install Sift.app to /Applications
```

CI (`.github/workflows/ci.yml`) runs `pnpm test` and `pnpm build` on every push
and pull request to `main`.

### Stack

Electron and `electron-vite`, React 19, TypeScript, Tailwind CSS v4, Zustand,
Recharts, `@anthropic-ai/sdk`, and Vitest.

## Contributing

Issues and pull requests are welcome at
[github.com/ashishyd/sift](https://github.com/ashishyd/sift). Please run
`pnpm typecheck` and `pnpm test` before opening a pull request.

## License

[MIT](LICENSE) © 2026 Ashish
