# Sift

**Know before you clear.**

AI-assisted storage cleanup for macOS. Sift scans the places your Mac and dev
tools quietly fill up — app caches, Xcode build artifacts, package manager
caches, old downloads, iOS backups, duplicate files, and more — ranks what's
safe to clear against what needs a second look, and tells you how much space
you'll actually get back.

Nothing is ever permanently deleted: everything goes through the macOS Trash,
so it's recoverable until you empty it yourself.

## Features

- **Top actions** — a single ranked list on the Dashboard, sorted by space
  freed × how confident Sift is it's safe, so you're not hunting through
  category cards to find the biggest win.
- **Explore** — a real folder-tree view (expand/collapse, folder/file icons,
  checkboxes, indent guides) of everything Sift found, not just a flat list.
- **Duplicate finder** — hashes files in Desktop/Documents/Downloads/Pictures
  to find exact-content duplicates, with a "keep first, trash the rest" action.
- **AI recommendations + chat** — Claude turns a scan into plain-English
  verdicts per category, and you can ask follow-up questions about a specific
  file or category. Works with an Anthropic API key *or* your local, already
  logged-in Claude Code CLI — no key required if you have Claude Code
  installed.
- **Permission-aware scanning** — Sift knows the difference between "this
  folder is genuinely empty" and "I couldn't read this folder," and tells you
  which in the UI instead of silently under-reporting. Settings has a live
  Folder Access panel with one-click links into System Settings for both
  per-folder access (Downloads/Desktop/Documents/Pictures) and Full Disk
  Access.
- **Ignore list** — mark an item "Ignore" and it won't resurface on the next
  scan; manage/undo the list from Settings.
- **Clear history** — every Trash action is logged (date, item count, bytes
  freed) with a running lifetime total, visible in Settings.
- **Menu bar companion** — a template-icon Tray item shows reclaimable space
  at a glance, re-scans in the background every few hours, and lets you scan
  or quit without opening the window. Closing the window hides it; the app
  keeps running until you quit from the Tray.

## How it works

- **Local heuristics** scan well-known cache/build/download locations using
  `du`/`find` and file metadata (size, last-modified). This works fully
  offline and is the default — always on, no setup.
- **Claude** (optional) turns the scan into a plain-English summary and
  per-category verdicts (`clear it` / `review first` / `keep`), and answers
  free-text follow-up questions. Only category labels, sizes, item counts and
  a few example filenames are sent — never file contents. Two ways to enable
  it, tried in this order:
  1. An Anthropic API key, entered in Settings and encrypted at rest via
     macOS Keychain (`safeStorage`).
  2. Your local Claude Code CLI (`claude`), if installed and logged in — Sift
     detects it automatically (checking both plain `PATH` and your login
     shell's `PATH`, since GUI apps often don't inherit the latter) and shells
     out to it non-interactively. No API key needed.

  If neither is available — or a call fails — Sift falls back to a
  transparent, rule-based local summary and says so in the UI rather than
  silently pretending nothing went wrong.
- **Duplicate finder** hashes files in Desktop/Documents/Downloads/Pictures to
  find exact-content duplicates.

## Categories Sift checks

App Caches, Xcode DerivedData/Archives/iOS DeviceSupport, Simulator caches,
npm/pnpm/yarn caches, Homebrew cache, Docker Desktop data, Trash, log files,
old Downloads, iOS device backups, Mail downloads, Messages attachments,
Pictures/Photos Library, stray `node_modules`, and large & unused files.

## Permissions

macOS gates read access to Downloads/Desktop/Documents/Pictures per-app (the
first read triggers a native consent dialog), and gates broader locations
(other apps' caches, Mail, Messages, iOS backups) behind Full Disk Access.
Sift scans the per-folder-protected locations first, with a progress label
naming exactly which folder it's requesting, so any system dialog appears in
context instead of at random. If a category comes back incomplete because of
a denial, the Dashboard shows a banner naming which ones and links straight
to the right System Settings pane — Sift never just shows "0 items" and lets
you assume that means "clean."

## Development

```bash
pnpm install
pnpm dev
```

```bash
pnpm typecheck   # tsc, main + renderer
pnpm test        # vitest — scanner/ignore-list/Claude-JSON-parsing unit tests
pnpm build       # typecheck + production bundle
pnpm build:mac   # production build → .dmg/.zip → installs Sift.app to /Applications
```

CI (`.github/workflows/ci.yml`) runs `pnpm test` and `pnpm build` on every
push/PR to `main`.

## Privacy & safety

- Deletion always goes through the macOS Trash (`trash` npm package) — never
  a permanent delete.
- Every clear action is confirmed with a native dialog showing item count and
  reclaimable size before anything moves.
- The optional Claude integration (API key or local CLI) sends category-level
  metadata only, never file contents; your API key never leaves your machine
  except to call Anthropic's API directly, and the CLI path never sends
  anything anywhere outside your own already-authenticated `claude` session.
- Every AI response is labeled with its actual source (Claude API, local
  Claude CLI, or offline heuristic) so you always know what generated it.

## Stack

Electron + Vite (`electron-vite`) + React 19 + TypeScript + Tailwind CSS v4 +
Zustand + Recharts + `@anthropic-ai/sdk` + Vitest.

## License

MIT
