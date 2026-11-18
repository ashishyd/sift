# Sift

Sift is a macOS desktop app that finds disk space a developer can safely reclaim and moves it to
the Trash. Tagline: "Know before you clear." It runs against the user's real home folder, so a
wrong path or a wrong delete call destroys real data. Treat every change with that in mind.

## How it is built

- Electron 39 + `electron-vite` 5, React 19, TypeScript 5.9, Tailwind CSS v4, Zustand 5, Recharts 3,
  `@anthropic-ai/sdk`, Vitest 5. Package manager is **pnpm 10**. CI uses Node 22.
- macOS only. The scanner shells out to `du`, `find`, `df`, `lsof`, `ps`, `sysctl`, `tmutil`,
  `xcrun simctl` and `osascript`.
- Three processes, three trust levels:
  - **main** (`src/main`): Node. Owns the filesystem, child processes, config, the API key, the
    tray and all network calls.
  - **preload** (`src/preload`): the only bridge. Exposes `window.api`, one function per IPC channel.
  - **renderer** (`src/renderer`): React UI. No Node, no network (CSP is `default-src 'self'`).
- Data flow for every feature:
  `component → store action (store.ts) → window.api.x() → ipcMain.handle('sift:x') → main module`.
- State lives in three places: the Zustand store (renderer, lost when the window closes),
  `lastSummary` in `tray.ts` (main, in memory), and two JSON files in `app.getPath('userData')`:
  `config.json` (encrypted API key, ignored paths, clear history, scan preferences) and
  `last-scan.json` (cached scan).
- The window is destroyed when closed and the app keeps running in the menu bar. Main must never
  assume a window exists.

## Folder map

```
src/main/            Main process
  index.ts           App lifecycle, window, and ALL ipcMain.handle registrations
  scanner.ts         Full scan, per-category scanners, listFolder, df parsing, cancel, coalescing
  categories.ts      CATEGORY_DEFS: every scanned location with its risk level
  exec.ts            run() (execFile, never rejects) + permission-error helpers
  trashOps.ts        moveToTrash (recoverable) and emptyTrash (permanent)
  hiddenSpace.ts     "Restart space" tab: swap, held-open deleted files, snapshots, sim runtimes
  aiApps.ts          AI_APP_DEFS: what Claude / Cursor / ChatGPT keep on disk, clearable or not
  duplicates.ts      Size-then-SHA-256 duplicate finder
  ai.ts              Claude suggestions and Q&A; API key, then CLI, then local heuristic
  claudeCli.ts       Finds and runs the user's local `claude` CLI
  claudeParse.ts     Electron-free JSON parser for Claude output (kept separate so it is testable)
  config.ts          config.json and last-scan.json; safeStorage for the API key
  permissions.ts     TCC folder checks, deep links into System Settings
  spaceMonitor.ts    Low-space notifications (pure evaluateAlert + timer)
  tray.ts            Menu bar item, background rescan, in-memory last summary
  *.test.ts          Unit tests, next to the code
src/preload/         index.ts = window.api; index.d.ts = Window typing
src/shared/          Pure TS used by both sides. No electron, no Node, no DOM imports.
  types.ts           Every type that crosses IPC
  preferences.ts     Defaults + normalizeScanPreferences (clamps) + categoryHiddenStats
  reclaimable.ts     computeReclaimableBytes, overlap dedupe, cache-name exclusions
src/renderer/src/
  App.tsx            Header, tab nav, toast, mounts the active view
  store.ts           The single Zustand store: all state and all actions
  components/        One default-exported component per file
  lib/format.ts      formatBytes, formatRelativeDate
  assets/main.css    Tailwind import + the --sift-* design tokens
build/ resources/    Icons, entitlements, tray template images
scripts/             install-to-applications.mjs (used by dist:mac)
docs/                A blog article. Not product documentation.
out/ dist/           Build output. Ignored. Never edit.
```

## Commands

```bash
pnpm install          # also runs electron-builder install-app-deps
pnpm dev              # run the app with hot reload
pnpm typecheck        # tsc for main+preload+shared, then renderer+shared
pnpm test             # vitest run (all unit tests)
pnpm vitest run src/main/scanner.test.ts        # one file
pnpm vitest run -t "excludes trash"             # one test by name
pnpm build            # typecheck + electron-vite build into out/
pnpm lint             # eslint + prettier check
```

Know this before you run anything:

- `pnpm dev` opens the real app on the real home folder. Scanning triggers macOS permission
  prompts. Clicking a clear button moves real files. Do not click through destructive flows to
  "test" them unless the user asked.
- **Do not run `pnpm dist:mac` without asking.** It deletes and replaces `/Applications/Sift.app`.
- **Do not run `pnpm format` or `eslint --fix` on the whole repo.** `pnpm lint` already fails on
  `main` with 2 errors and 89 prettier warnings in files nobody is working on. A repo-wide format
  buries your change in an unrelated diff. Most existing files already carry prettier warnings,
  so do not reformat lines you did not write. Run `pnpm eslint <files you changed>` before and
  after: no errors, and no more warnings than before. Report that, not "lint passes".
- CI (`.github/workflows/ci.yml`) runs `pnpm test` and `pnpm build` only. Lint is not in CI.

## Coding rules

Style (enforced by prettier and eslint): single quotes, no semicolons, 100 columns, no trailing
commas, 2 spaces. Every function has an explicit return type, including components
(`React.JSX.Element` or `React.JSX.Element | null`) and inline arrows in the store (`(): void =>`).

Process boundaries:

- Main and preload import shared code by relative path: `'../shared/types'`. The `@shared/*` and
  `@renderer/*` aliases exist only for the renderer and Vitest. Using an alias in `src/main`
  breaks the build.
- `src/shared` must stay pure. If a file there imports `electron`, `fs` or `path`, the renderer
  typecheck fails.
- The renderer never touches Node, the filesystem or the network. If the UI needs something new,
  add an IPC channel.

Adding an IPC channel takes all of these, in this order:

1. Types in `src/shared/types.ts`.
2. The work in a `src/main/<module>.ts` function.
3. `ipcMain.handle('sift:<camelCase>', ...)` in `src/main/index.ts`, inside `whenReady`.
4. A matching function on `api` in `src/preload/index.ts` (`SiftApi` is derived from it).
5. A store action in `store.ts` that calls it, sets loading flags, catches errors and calls `showToast`.
6. The component calls the store action.

Running system binaries:

- Use `run(cmd, argv[])` from `exec.ts`. It uses `execFile` with no shell.
- `run()` never rejects. A `try/catch` around it catches nothing. Check `code` and `stderr`.
- Any value from the renderer that goes into a command line or an AppleScript string must be
  validated with a strict regex first. Copy `quitApp`, `deleteSnapshots` and
  `deleteSimulatorRuntime` in `hiddenSpace.ts`.

Deleting things:

- Clearing files goes through `moveToTrash` (`shell.trashItem`) only. There is no `fs.rm`,
  `fs.unlink` or `rm` anywhere in `src`. Keep it that way.
- A permanent action needs a native `dialog.showMessageBox` with Cancel as `defaultId` and
  `cancelId`, and text that says it is permanent. Put the dialog in main, next to the action.
- After a successful trash, the `sift:trash` handler prunes `last-scan.json` and appends clear
  history, and `trashPaths` in the store updates the summary, selection, folder cache and
  duplicates. A new clearing path must call `trashPaths` so all of these stay in sync.

Permissions (macOS TCC):

- "Folder is missing", "folder is empty" and "macOS refused" are three different results. Use
  `isPermissionErrno(err)` for `fs` errors and `isPermissionError(stderr)` for `du`/`find`, and set
  `permissionDenied` on the result. Never turn a denial into "0 items".
- The first read of Downloads, Desktop, Documents or Pictures shows a system prompt. Do not add
  reads of those folders at startup. Keep `TCC_SENSITIVE_FIRST` first in the scan order and keep
  the 30-second delay before the tray's first background scan.

Scan results and totals:

- A category lists at most 200 items, but `totalSizeBytes` and `matchedItemCount` cover everything
  found. Never compute a total by summing `items`. Use `categoryHiddenStats` to show the remainder.
- Whenever items are removed from a summary, recompute `totalSizeBytes`, `matchedItemCount` and
  `reclaimableBytes` (with `computeReclaimableBytes`). Trash is excluded from reclaimable.
- `runFullScan` shares one in-flight scan between the UI and the tray. Do not start a second scan
  path.

Window lifecycle:

- Get the window through `ensureWindow()`. Before `webContents.send`, check `isDestroyed()`, and
  for a window that was just recreated, wait for `did-finish-load` (see `spaceMonitor.ts`).
- Register IPC handlers once in `whenReady`, never per window.

Config and secrets:

- Write config only through `patchConfig`. Read preferences only through
  `normalizeScanPreferences`, so bad or old values are clamped.
- The API key stays in main. The renderer only ever gets `hasApiKey: boolean`. Never log it,
  return it over IPC or write it unencrypted.
- A new preference touches five places: `ScanPreferences` in `types.ts`, `DEFAULT_SCAN_PREFERENCES`,
  a clamp in `normalizeScanPreferences`, the consumer, and a field in `SettingsModal.tsx`.

Claude integration:

- Only `categoryBriefFor()` output goes to Claude: labels, sizes, counts and up to 8 item names
  per category. Never send file contents or full paths. The README and the Settings text promise this.
- Keep the fallback order (API key, local CLI, offline heuristic) and always set `source`. Set
  `errorReason` only when a configured Claude call failed.
- The model is named in two places: `MODEL` in `ai.ts` and `--model` in `claudeCli.ts`. Changing
  it affects cost. Ask first.
- Tests must never call the real API or the real CLI.

Tests:

- Vitest runs in the `node` environment and only picks up `src/**/*.test.ts`. There is no jsdom
  and no component test setup. Do not add one unasked.
- Test pure functions. If the logic sits in a module that imports `electron`, either export the
  pure part and `vi.mock('electron', ...)` above the import (see `hiddenSpace.test.ts`), or move
  the pure part to an electron-free file (see `claudeParse.ts`).
- New parsing, math or decision logic gets a test with a realistic sample of the command output.

Renderer:

- Read the store with one selector per value: `useSiftStore((s) => s.summary)`. Do not
  destructure the whole store.
- `selected` is a `Set`. Always create a new `Set` when changing it.
- Errors surface through `showToast`. A user cancelling a native dialog is not an error; the store
  swallows messages matching `/cancel/i`.
- The `react-hooks` v7 lint rules are strict. Do not call `setState` synchronously in an effect.
- UI-only state (expanded rows, form drafts) is local `useState`. Anything shared or fetched goes
  in the store.

## Design rules

- Dark theme only. All colours are the `--sift-*` variables in `assets/main.css`, used as Tailwind
  arbitrary values: `bg-[var(--sift-surface)]`, `text-[var(--sift-text-muted)]`. There is no
  `tailwind.config`. Do not add hex values or Tailwind palette colours. The few that exist
  (`#3a4152`, `#1e222c`, `amber-400/10`, `orange-500/10`) are legacy, not a pattern.
- Risk has one colour language everywhere: safe = `--sift-safe` (teal), caution = `--sift-caution`
  (amber), review = `--sift-review` (coral). Use `RiskBadge` for the label. Coral also marks
  destructive actions. Do not use these colours for anything else.
- Type scale is pixel values: `11`, `11.5`, `12`, `12.5` (default secondary text), `13` (default
  body), `13.5`, `15` (card title), `16` (page title). Pick from this list.
- Surfaces: card = `rounded-xl border border-[var(--sift-border)] bg-[var(--sift-surface)]`.
  Rows inside a card are separated with `divide-y divide-[var(--sift-border)]`, padded `px-4 py-2.5`.
- Buttons, four kinds only:
  - Primary: `rounded-lg bg-[var(--sift-accent)] text-black font-medium`.
  - Soft: `bg-[var(--sift-accent-soft)] text-[var(--sift-accent)]`.
  - Destructive: coral text link, or `bg-[var(--sift-review)] text-black` in a selection bar.
  - Quiet: muted text that brightens on hover.
- Numbers that line up in a column use `tabular-nums`. Sizes always go through `formatBytes`,
  dates through `formatRelativeDate`.
- Long names and paths get `truncate` with the full value in `title`.
- Icons are small inline SVGs or text glyphs (`⚙ ⚠ ✦ ✓`). No icon library.
- Charts use Recharts with `isAnimationActive={false}` and token colours.
- Every view handles four states: not scanned yet, scanning, empty, and permission denied.
- Wording:
  - Recoverable action: "Move to Trash" or "Clear". Say it is recoverable.
  - Permanent action: the label says "permanently" or ends with "…" ("Delete…"), and a native
    dialog always follows.
  - Counts are written "3 item(s)". Sentence case. No exclamation marks.
  - Never show a clean result when the scan was incomplete. Say what could not be read and link
    to the right System Settings pane.
- New layout, a new colour, a new font size or a new dependency for UI is a design decision. Ask.

## Mistakes a weaker model makes here

| Mistake | Do this instead |
| --- | --- |
| Deletes with `fs.rm` or `rm -rf` because it is simpler | `moveToTrash` only. Permanent actions need a native confirm dialog in main. |
| Builds a command with a template string and `exec` | `run(cmd, [args])`. Validate renderer input with a regex before it reaches `osascript`. |
| Wraps `run()` in `try/catch` and assumes success | `run()` never throws. Check `code` and `stderr`. |
| Treats a permission denial as an empty folder | Set `permissionDenied`. The banner depends on it. |
| Imports `@shared/...` inside `src/main` | Relative import. The alias is renderer-only. |
| Imports `fs` or `electron` in `src/shared` or the renderer | Add an IPC channel. Keep `shared` pure. |
| Adds the IPC handler but forgets preload, or the store | Follow the six steps above. Typecheck catches a missing preload entry only if a caller exists. |
| Sums `items` to get a category size | Use `totalSizeBytes`. The list is capped at 200. |
| Removes items from a summary without recomputing totals | Recompute the three totals. Copy `trashPaths` in `store.ts`. |
| Adds a category whose paths overlap another | Add the folder name to `USER_CACHES_DEDICATED_NAMES`, or a pair to `PATH_OVERLAP_PREFERENCE`, plus a test. Otherwise space is counted twice. |
| Picks a risk level, or marks an AI-app folder `clearable: true`, by guessing | These decide whether user data is one click from the Trash. Ask the user. Chats, logins and settings are never clearable. |
| Adds a scanner that needs `find` but leaves it a shallow category | Follow `scanOrphanedDmgs`: add to `SPECIAL_SCAN_IDS`, the progress count, the disabled check and `doFullScan`. |
| Sends to `mainWindow.webContents` directly | The window may be gone. Use `ensureWindow()` and the destroyed/loading checks. |
| Reads a protected folder on launch | Triggers a permission prompt with no context. Read on user action only. |
| Sends paths or file contents to Claude "for better answers" | Breaks the privacy promise. Only `categoryBriefFor` output leaves the machine. |
| Returns the API key to the renderer to "show it masked" | Return a boolean. |
| Writes a React component test, adds jsdom and testing-library | Not set up here. Extract the logic to a pure function and test that. |
| Runs `pnpm format` or `eslint --fix .` to get lint green | Creates a huge unrelated diff. Keep your own lines clean and leave the rest. |
| Runs `pnpm dist:mac` to "verify the build" | Use `pnpm build`. `dist:mac` replaces the installed app. |
| Verifies a clear flow by clicking it in `pnpm dev` | That moves the user's real files. Test the pure logic; ask before driving destructive UI. |
| Installs an icon, modal, toast or date library | Inline SVG, the existing modal and toast, `lib/format.ts`. No new dependencies unasked. |
| Hard-codes a colour or uses `text-sm` | Tokens and the pixel type scale above. |
| Refactors `store.ts`, `scanner.ts` or `SettingsModal.tsx` because they are long | Make the smallest change. Do not split, rename or reorganise unasked. |
| Says "should work" without running anything | Run the checklist and report exactly what ran. |

## How to work

1. Before anything non-trivial, say in two or three lines what you will change and how you will
   prove it works. Then start, unless something is ambiguous or cannot be undone.
2. Read the code you will touch and grep every caller of anything you change.
3. Make the smallest complete change. Match the neighbouring code.
4. Ask before you: commit, push, run `dist:mac`, delete files, add a dependency, change a risk
   level or `clearable` flag, change what is sent to Claude, change the model, or change the
   shape of `config.json`.
5. When two approaches are both reasonable, give each in one line and say which you would pick.
6. If the same fix fails twice, stop and say what you learned.
7. Do not open `.env` files or key files.

## Before you say a task is done

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes, and new logic has a test.
- [ ] `pnpm build` passes.
- [ ] `pnpm eslint <files you changed>` shows no errors and no more warnings than before.
- [ ] New IPC channel: handler, preload entry, shared type and store action all exist.
- [ ] No new permanent delete. Anything permanent has a native confirm dialog.
- [ ] No renderer input reaches a command line or AppleScript unvalidated.
- [ ] Denied, missing and empty are still reported as different things.
- [ ] Totals are recomputed wherever items are removed.
- [ ] Nothing new is sent to Claude, and the API key never leaves main.
- [ ] UI uses only `--sift-*` tokens, the type scale and the four button kinds.
- [ ] UI change was looked at in `pnpm dev`, or the report says it was not.
- [ ] `README.md` is updated if a user-visible feature, category or permission changed.
- [ ] `git status` shows only files that belong to the task.

Report in this order: the outcome; files changed; commands run with their results; what was not
verified ("I did not run X"); what the user must do next; anything noticed but not fixed, one line
each.
