# Sift

**Know before you clear.**

AI-assisted storage cleanup for macOS. Sift scans the places your Mac and dev
tools quietly fill up — app caches, Xcode build artifacts, package manager
caches, old downloads, stray `node_modules`, large forgotten files, duplicate
files — and tells you what's safe to clear and how much space you'll get back.

Nothing is ever permanently deleted: everything goes through the macOS Trash,
so it's recoverable until you empty it yourself.

## How it works

- **Local heuristics** scan well-known cache/build/download locations using
  `du`/`find` and file metadata (size, last-modified). This works fully
  offline and is the default.
- **Claude** (optional) turns the scan into a plain-English summary and
  per-category verdicts (`clear it` / `review first` / `keep`) — only
  category labels, sizes, item counts and a few example filenames are sent,
  never file contents. Add your own Anthropic API key in Settings to enable
  it; your key is encrypted at rest via macOS Keychain (`safeStorage`).
- **Duplicate finder** hashes files in Desktop/Documents/Downloads/Pictures to
  find exact-content duplicates.

## Categories Sift checks

App Caches, Xcode DerivedData/Archives/iOS DeviceSupport, Simulator caches,
npm/pnpm/yarn caches, Homebrew cache, Docker Desktop data, Trash, log files,
old Downloads, iOS device backups, Mail downloads, Messages attachments,
Pictures/Photos Library, stray `node_modules`, and large & unused files.

## Development

```bash
pnpm install
pnpm dev
```

```bash
pnpm typecheck   # tsc, main + renderer
pnpm build       # typecheck + production bundle
pnpm build:mac   # production .dmg (electron-builder)
```

## Privacy & safety

- Deletion always goes through the macOS Trash (`trash` npm package) — never
  a permanent delete.
- Every clear action is confirmed with a native dialog showing item count and
  reclaimable size before anything moves.
- The optional Claude integration sends category-level metadata only; your
  API key never leaves your machine except to call Anthropic's API directly.

## Stack

Electron + Vite (`electron-vite`) + React 19 + TypeScript + Tailwind CSS v4 +
Zustand + `@anthropic-ai/sdk`.

## License

MIT
