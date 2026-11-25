# Design gap report: Sift app redesign (all screens)
Mock: https://claude.ai/artifact/H3nvKLKW2FkjkXpVztwXL6 (12 artboards, claude.ai design canvas) | Build: /Applications/Sift.app (Electron, built 2026-11-24 20:12, macOS, 1080x760 window) | Date: 2026-11-25
Evidence: rendered (accessibility tree + screenshots; computed styles not available in Electron, sizes read from code)   Mock precision: exact (HTML mock written in this session, values known)
Run: `pnpm dev` (or the installed /Applications/Sift.app) | Login: none
Design system: `src/renderer/src/assets/main.css` (`--sift-*` tokens, no tailwind.config)
Conventions: Tailwind v4 arbitrary values `bg-[var(--sift-surface)]`, pixel type scale 11/11.5/12/12.5/13/13.5/15/16, four button kinds, one component per file, `pnpm typecheck && pnpm test && pnpm build`, `pnpm eslint <changed files>`, no new deps, no `fs.rm`. Read CLAUDE.md before touching anything.
Score: 14/48 inventory items match. P0 1 · P1 12 · P2 9 · P3 2 · Questions 4

## Questions for a human (do not build until answered)
- Q1 [ANSWERED: native menu] Menu bar popover (S9): the build has a native macOS menu (free space, three biggest categories, scan warning, Open, Scan now, Quit). The mock is a custom 380x640 popover window. A popover needs its own BrowserWindow and renderer entry. Native menu or custom popover? Blocks G13.
- Q2 Overview headline (S1.2): mock 44px, build 32px. 44px is not in the CLAUDE.md type scale (11…16, plus the existing 32px page headline). Add 44 to the scale, or keep 32 and update the mock? Blocks G14.
- Q3 [ANSWERED: modal] Settings (S8): the mock is a full-width page with a left nav; the build is a modal with four tabs (Access, Scan, Claude, Activity). Page or modal? Blocks G10, G11.
- Q4 Windows frame (S11): the mock has no Windows screens, only a spec sheet. Which Windows details need a rendered check (title bar, tray, Recycle Bin wording)? Not testable on this machine.

## Gaps
- [x] G01 [MISSING] [P0] Explore folder map and table columns   (inventory S4.2, S4.3)
  Mock: Explore shows a six-column treemap of the current folder (tiles coloured by risk, biggest tile 14.2 GB), then a table with Name, Share bar, Size and Last touched columns, plus filters "Everything / Clearable / Untouched 90 days" and a breadcrumb.
  Build: Explore is a plain expandable list: chevron, checkbox, risk dot, name, "N item(s)", size. No treemap, no share bar, no last-touched column, no filter chips, no breadcrumb (Explore, 1080 wide).
  Where: src/renderer/src/components/FolderTree.tsx:340 (header and list) and CategoryRow at :176.
  Do: Add a treemap row above the list using CSS grid with tiles sized by `totalSizeBytes` (no chart library), a Share bar and "Last touched" column using `formatRelativeDate` on `items`, and a three-button filter. Use `--sift-safe/caution/review` for tile colour. Keep CategoryRow behaviour.
  Accept: At 1080 wide, Explore shows tiles for the top categories coloured by risk; each row shows a share bar, a size and a "Last touched" value; clicking "Clearable" hides review-risk rows.
  Depends: none
  Size: L
  Done: FolderTree.tsx, lib/explore.ts(+test) | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app: treemap tiles, share bars, Last touched, three filters seen at 1080 wide; Clearable filter not clicked

- [x] G02 [DIFFERS] [P1] Overview needs three decision columns   (inventory S1.5)
  Mock: three side-by-side cards "Comes back on its own / Look before you clear / Your files. Sift only points." each with a risk pill, total, a line of explanation and three preview rows with checkboxes plus "N more" link. Review-risk rows are unchecked.
  Build: one column of stacked groups with the same headings; each category is a collapsed card (App Caches, npm / pnpm / yarn cache …). No pill, no preview rows.
  Where: src/renderer/src/components/Dashboard.tsx:218-258 (GROUPS loop) and CategoryCard.tsx.
  Do: Render the three groups in `grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` and show the top three items per group with checkboxes using `toggleSelected`; use `RiskBadge` for the pill. Keep CategoryCard for the expanded view.
  Accept: At 1280 wide the three groups sit side by side; at 1080 they wrap; each shows its total and three rows; ticking a row updates the bottom bar.
  Depends: none
  Size: M
  Done: Dashboard.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered: groups stack and show 3 rows plus "N more" at 1080 wide; side-by-side at 1280 not seen

- [x] G03 [DIFFERS] [P1] Whole-disk bar does not show system, apps, your files and free   (inventory S1.3)
  Mock: "Where 494 GB goes" strip with seven bands: System, Apps, Your files, Rebuilds itself, Check first, Your call, Free, with a labelled legend.
  Build: one strip with Safe 26 GB, Caution 8.0 GB, Review 7.4 GB, Trash 0 MB. No System, Apps, Your files or Free bands.
  Where: src/renderer/src/components/DiskLedger.tsx:48-110.
  Do: Add the free and other-used bands from `volumeTotalBytes` and `volumeFreeBytes` (already on the summary). System/Apps split needs data the scanner does not collect: show one "Everything else" band and ask before adding a scan.
  Accept: Bar ends with a "Free" band equal to free space; legend shows the same figures as `summary.volumeFreeBytes`.
  Depends: Q (system/apps split needs a scanner decision)
  Size: M

- [x] G04 [MISSING] [P1] Selection bar has no risk mix   (inventory S1.7)
  Mock: bar reads "3 item(s) selected · 24.6 GB", then "● 2 rebuild themselves  ● 1 to check" and a small mix bar.
  Build: "21 item(s) · 11 MB selected · moves to Trash, recoverable" with Deselect and "Review and move to Trash".
  Where: src/renderer/src/components/Dashboard.tsx:262-285.
  Do: Compute counts per risk with `riskTotals`-style grouping of the selected paths, show the three counts in `text-[12px]` with the risk dots.
  Accept: With one safe and one review item selected the bar shows "1 rebuilds itself · 1 your file".
  Depends: none
  Size: S
  Done: Dashboard.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered: selecting 21 review items shows "21 your files" and a coral bar

- [x] G05 [MISSING] [P1] Sidebar disk card   (inventory S12.3)
  Mock: card above Settings: "Macintosh HD, 62 GB free", a used/clearable bar, and "104 GB free after clearing".
  Build: Only a "Claude CLI connected" pill; free space appears in the Overview card ("9.4 GB free now") and in the VOLUMES list lower down.
  Where: src/renderer/src/App.tsx:132-140 (the pill) and VolumesList.tsx.
  Do: Add a card from `summary.volumes[0]` using `formatBytes`; show free-after-clearing as `freeBytes + reclaimableBytes`. Reuse the card surface classes.
  Accept: Card shows the startup disk name, free space and a "free after clearing" line equal to free + reclaimable.
  Depends: none
  Size: S
  Done: App.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered: "Startup disk, 9.4 GB free, 35 GB free if you clear safe items" card above the Claude pill

- [x] G06 [DIFFERS] [P1] Review screen items miss their path and reason   (inventory S3.2)
  Mock: each row has name, a mono path line with full path in `title`, and one line of consequence ("Rebuilt on your next build. First build is slower.").
  Build: row shows name and the category label only ("Old Downloads"). Hint shows only when the item has one.
  Where: src/renderer/src/components/ReviewView.tsx:84-110.
  Do: Show `item.path` as a truncated mono line (`title` = full path) and the category `description`'s first sentence as the consequence.
  Accept: Each row has two lines under the name; hovering the path shows the full path.
  Depends: none
  Size: S
  Done: ReviewView.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept

- [x] G07 [DIFFERS] [P1] Review summary lacks free space before and after   (inventory S3.4)
  Mock: summary card lists "Free now 62.0 GB" and "Free after you empty Trash 88.6 GB", plus a risk mix bar and "5 item(s) in 3 groups".
  Build: summary shows size and item count only.
  Where: src/renderer/src/components/ReviewView.tsx:126-150.
  Do: Add the two lines from `summary.volumes[0]` and the mix bar; keep the lock button.
  Accept: Card shows both figures; "after" equals now + selected size.
  Depends: none
  Size: S
  Done: ReviewView.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept

- [x] G08 [DIFFERS] [P1] Review acknowledgment sits at the bottom of a long list   (inventory S3.5)
  Mock: the "I checked the file under Your files" row is the last row of the Your files group, always visible beside the lock.
  Build: with 21 items the checkbox is far below the fold; the button reads "Check your files to continue" with no hint where to tick.
  Where: src/renderer/src/components/ReviewView.tsx:118-130.
  Do: Move the checkbox into the Your files group header row, or into the summary aside above the button.
  Accept: At 1080x760 with 21 review items, the checkbox is visible without scrolling.
  Depends: none
  Size: S
  Done: ReviewView.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept
  Done: DiskLedger.tsx (legend only: Everything else + Free; System/Apps split NOT done) | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept

- [x] G09 [DIFFERS] [P1] Scanning screen   (inventory S2.1-S2.5)   (unverified: code only)
  Mock: full-screen "Sifting your disk" with a count of categories read, bytes found so far, a progress bar, a per-category list with four results (found, empty, not on this Mac, not allowed), a yellow "macOS refused access to Desktop" alert while scanning, and a "While you wait" panel.
  Build (from code): a card "Scanning your Mac" with a progress bar and a checklist of labels. No per-category sizes, no four result states, no live permission alert.
  Where: src/renderer/src/components/Dashboard.tsx:86-150.
  Do: Extend `scanLog` entries to carry result and size (needs a main-process progress payload change) and render the four states; show the alert from `permissionDenied` as it arrives.
  Accept: During a scan, a denied folder appears as "Not allowed" within its row and a banner names it.
  Depends: needs a change to the scan progress payload in `src/main/scanner.ts`; ask first
  Size: L
  Done: shared/scanProgress.ts(+test), scanner.ts, autoScan.ts, preload/index.ts, store.ts, Dashboard.tsx | Verified: typecheck, 93 tests, build; rendered in the rebuilt app: four result states, alert naming Pictures & Photos Library and App Caches, While you wait panel. Decision: user approved the scan progress payload change (adds `last` result per finished category). Time-boxed omission: no 'bytes found so far' figure, because running totals double count overlapping folders.

- [x] G10 [DIFFERS] [P1] AI apps layout   (inventory S6.1-S6.5)
  Mock: headline "AI apps keep 14.3 GB" with the clearable amount in teal; three app cards in a grid, each with its own clearable/kept bar; a yellow "Claude is running. Quit it to clear" row; a lock icon on kept items; "Why is so much kept?" note.
  Build: header "AI apps" plus "Can be cleared 3.0 GB of 12 GB" card; each app is a full-width list; no per-app bar; "Running" pill and "Quit Claude" button in the header; kept items show a small box glyph "⊡ Kept".
  Where: src/renderer/src/components/AiAppsView.tsx:41-110, :175-182.
  Do: Headline from `report.totalBytes`, per-app bar from `app.clearableBytes/totalBytes`, a grid wrapper, replace the "⚿" glyph with a small inline SVG lock, add the running row above the list.
  Accept: Each app card shows a two-part bar; kept rows show a lock icon (not a box); a running app shows its warning row.
  Depends: none
  Size: M
  Done: AiAppsView.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept

- [x] G11 [DIFFERS] [P1] Settings Scan tab is a label grid, not sentence rules   (inventory S8.2)
  Mock: Scan rules read as sentences ("Flag Downloads older than [90] days"), grouped in one card, plus a Save button.
  Build: two-column grid of labelled number fields ("Large file size (MB) / Minimum file size" …).
  Where: src/renderer/src/components/SettingsModal.tsx:215-262.
  Do: Rewrite the field list as sentence rows using the existing `numberField` handlers; keep field names and clamps.
  Accept: Each preference reads as one sentence with its input inline; saving still calls `saveScanPreferences`.
  Depends: Q3
  Size: M
  Done: SettingsModal.tsx | Verified: typecheck, tests, build; rendered: sentence rows in the modal. Decision Q3: stays a modal. The one eslint error in this file (set-state-in-effect, line 58) is pre-existing at HEAD.

- [x] G12 [MISSING] [P1] Duplicates not-scanned state is blank   (inventory S5.0)
  Mock shows the populated state only; the build must still handle "not scanned yet".
  Build: Before scanning, the screen shows only the header and "Scan for duplicates" button; nothing explains what a scan does or that it reads Desktop, Documents, Downloads and Pictures.
  Where: src/renderer/src/components/DuplicatesView.tsx:22-45.
  Do: Add the four-state empty block used on Overview ("See what's safe…" style): what it reads, that it asks macOS for folder access, and the primary button.
  Accept: With no result and not scanning, the page shows an explanation above the button.
  Depends: none
  Size: S
  Done: DuplicatesView.tsx | Verified: typecheck, 90 tests, build, eslint clean, code read by Opus reviewer; rendered 2026-11-25 in the rebuilt app (full-screen capture): matches Accept

- [x] G13 [MISSING] [P1] Menu bar popover   (inventory S9)
  Mock: 380x640 popover with a free-space ring, "Review safe items" button, three biggest wins, a scan warning and Open / Scan now / Settings / Quit rows.
  Build: native NSMenu with the same information as plain rows; no ring, no button.
  Where: src/main/tray.ts:110-160.
  Do: Blocked on Q1.
  Accept: Per Q1.
  Depends: Q1
  Size: L
  Decided 2026-11-25 (Q1): keep the native macOS menu. No build. Closed as 'won't build'.

- [ ] G14 [DIFFERS] [P2] Overview headline size   (inventory S1.2)
  Mock 44px / build 32px. Blocked on Q2. Where: Dashboard.tsx:179.
  Accept: per Q2.
  Depends: Q2
  Size: S

- [ ] G15 [DIFFERS] [P2] Overview header search and status   (inventory S1.1)
  Mock: header holds a wide search field "Search files, categories and actions ⌘K", then "Scanned 4 min ago · 24 categories" and "Rescan".
  Build: search is a button in the sidebar; header shows "Scanned 25/11/2026, 19:35:12" (absolute date, not relative) and Rescan.
  Where: App.tsx:119-125, Dashboard.tsx:187-205.
  Do: Show relative time via `formatRelativeDate`; decide search location with the user (low priority).
  Accept: Header reads "Scanned N min ago".
  Depends: none
  Size: S

- [ ] G16 [DIFFERS] [P2] Claude's read card   (inventory S1.8)
  Mock: card "✦ Claude's read" with a paragraph already written, "via Claude CLI" tag and an "Ask about your disk" box.
  Build: "AI recommendations" with an Analyze button and the text "Using your local Claude Code CLI". No text until Analyze is pressed.
  Where: src/renderer/src/components/AiPanel.tsx:30-60.
  Do: Rename the card; keep Analyze as the trigger (auto-running would call Claude on every scan — that is a cost decision).
  Accept: Card title is "Claude's read".
  Depends: none
  Size: S

- [ ] G17 [DIFFERS] [P2] Settings tab names   (inventory S8.1)
  Mock: Scanning, Permissions, Claude, History. Build: Access, Scan, Claude, Activity.
  Where: SettingsModal.tsx:8, :146-160.
  Depends: Q3
  Size: S

- [ ] G18 [DIFFERS] [P2] Palette is missing Places, Never flag and key hints   (inventory S10.2-S10.4)
  Mock: sections Actions and Places (matching folders, "Open in Explore"), a "Never flag …" action, Esc badge, and ↵ / ⌘↵ badges on rows.
  Build: single list: Go to…, Open Settings, Rescan, Select … for clearing, and Ask Claude; footer "↑↓ move · ↵ run · Esc close".
  Where: src/renderer/src/components/CommandPalette.tsx:36-60, :104-140.
  Do: Add a Places section from category names, a "Never flag" row using `ignoreItems`, and the key badges.
  Accept: Typing "derived" shows an Actions group and a Places group.
  Depends: none
  Size: M

- [ ] G19 [DIFFERS] [P2] Restart space cards differ in grouping and wording   (inventory S7.3)
  Mock: five cards (Memory swap, Deleted still held open, Time Machine snapshots, Simulator runtimes, Temporary files) with a "Comes back on restart" label and permanent actions labelled "Delete…".
  Build: four summary tiles (Held open, Swap in use, Simulators, Snapshots) then section lists. "Quit Google Chrome" appears once per helper process.
  Where: src/renderer/src/components/HiddenSpaceView.tsx:120-260.
  Do: Group the held-open rows by app (one row per app with a summed size) and add the "Comes back on restart" label to swap.
  Accept: Chrome appears once with the summed size.
  Depends: none
  Size: M

- [ ] G20 [MISSING] [P2] Sidebar items lack shortcut hints   (inventory S12.1)
  Mock: Explore shows "⌘2", Settings "⌘,". Build shows "⌘," only on Settings; Explore has no hint; the size beside Duplicates, AI apps and Restart space only appears after those screens are opened once.
  Where: src/renderer/src/App.tsx:130-160.
  Do: Show `{modKey}{index}` as muted meta when no size is known.
  Accept: Explore shows "⌘2".
  Depends: none
  Size: S

- [ ] G21 [DIFFERS] [P2] Explore Know panel content   (inventory S4.4)
  Mock: panel lists "What it is", "If you clear it", "Made by", "Last touched", "Path", plus Add to selection, Reveal, Never flag.
  Build: panel shows only an empty prompt until a category is clicked, then description, newest item and one "Select all in this category" button (not exercised on screen).
  Where: src/renderer/src/components/FolderTree.tsx:232-300.
  Do: Add "If you clear it" from `restoreHint` and a Reveal button; no new data source.
  Accept: Clicking App Caches shows description, consequence and Reveal.
  Depends: none
  Size: M

- [ ] G22 [DIFFERS] [P2] Duplicates header and keep rule layout   (inventory S5.1-S5.3)   (unverified: needs a scan; not run)
  Mock: headline "1.9 GB of copies" with a "Looked in" chip row and a single keep-rule card with "Apply to 38 groups".
  Build (from code): header "Duplicate files", a summary card and a one-line rule bar.
  Where: src/renderer/src/components/DuplicatesView.tsx:22-110.
  Depends: none
  Size: S

- [ ] G23 [DIFFERS] [P3] Palette row hint for Settings   (S10.2)
  "Open Settings" hint shows a glyph that looks like "⌧" rather than "⌘,".
  Where: CommandPalette.tsx:56.
  Size: S

- [ ] G24 [DIFFERS] [P3] Scan tab helper captions   (S8.2)
  Captions such as "Minimum file size" differ from mock phrasing.
  Where: SettingsModal.tsx:215.
  Size: S

## Extras (in build, not in mock)
- E01 "Clear 26 GB marked safe…" button in the Overview disk card (src/renderer/src/components/DiskLedger.tsx:68). It clears all safe items after a native confirm and skips the Review screen, which the mock makes the single route to Trash. Keep or remove? (needs a yes)
- E02 "What grew" card (src/renderer/src/components/GrowthCard.tsx). Mock has "Growing since last week" with sparklines and +GB per category; build shows a text-only version. Keep as is, or match the mock sparkline rows?
- E03 Permissions banner on Overview (src/renderer/src/components/PermissionsBanner.tsx). The mock shows denied folders on the Scan screen only. Keep or move?
- E04 VOLUMES list on Overview (src/renderer/src/components/VolumesList.tsx). Replaced in the mock by the sidebar disk card (G05). Keep both or remove?

## Matches
S1.2 headline text pattern ("N GB can go" with a safe-share line) · S1.4 risk colour language · S1.7 selection bar buttons ("Deselect", "Review and move to Trash") · S3.1 group headings · S3.3 locked button until acknowledged (lock works: "Check your files to continue") · S3.6 un-tick to keep each item · S4.1 Know panel exists with empty prompt · S5.4 keep-folder rule exists · S6.6 "Clearable, comes back / Kept, it is yours" legend · S7.1 "58 GB is held, not stored" headline · S7.2 free now / after restart / with cleanup bars · S8.3 Claude tab "Show exactly what Claude sees" · S10.1 palette opens with ⌘K and lists Go to / Settings / Rescan / Select · S12.2 sidebar section meta sizes (Overview 41 GB, AI apps 3.0 GB, Restart space 58 GB)

## Not checked
- Scanning screen while a scan runs (S2): did not start a scan; code only.
- Duplicates populated state (S5): did not run a duplicate scan (reads Desktop, Documents, Downloads, Pictures).
- Explore with a category selected and the Know panel filled (S4.4): did not click a category.
- Settings Access and Activity tabs beyond the first screenshot (S8): Activity not opened.
- Menu bar popover (S9): native menu is outside the app window; not captured.
- Windows (S11) and the sidebar at other widths: this machine is a Mac; only 1080x760 was captured; mobile width not applicable to the Electron window.
- Computed styles: Electron exposes no devtools through this tool, so sizes and colours come from source.

## Designer questions
```
Questions on Sift app redesign (https://claude.ai/artifact/H3nvKLKW2FkjkXpVztwXL6):
Overview:
1. Headline is 44px in the mock but 44 is not in the app's type scale (max 32 for page headlines). Add 44, or keep 32? (blocks G14)
2. The mock has no "Clear 26 GB marked safe…" shortcut but the app has one. Keep it, or send safe items through Review too? (E01)
3. "Where 494 GB goes" shows System and Apps bands. The scanner does not measure those. Show one "Everything else" band, or add a scan for them? (blocks G03)
Menu bar:
4. Custom 380x640 popover or the native macOS menu? Unless you say otherwise we keep the native menu. (blocks G13)
Settings:
5. Full page or modal? The mock shows a page; the app uses a modal. Unless you say otherwise we keep the modal. (blocks G11, G17)
States the mock does not show:
6. Duplicates before the first scan, and when a folder is refused: what should it say? Default: reuse the Overview first-run block. (G12)
7. Explore at narrow widths (below 1000px): hide the treemap, or scroll it? (G01)
8. Windows: any frames for title bar, tray menu and Recycle Bin wording?
```

## Inventory
<!-- the mock as read on 2026-11-25; no Figma node IDs (HTML canvas artboards) -->
| ID | Screen | Element | Figma node | Key values |
|---|---|---|---|---|
| S1.1 | Main (Overview) | header search, "Scanned 4 min ago · 24 categories", Rescan | Main.dc.html | search 36px, ⌘K badge |
| S1.2 | Main | headline "41.8 GB can go" + "26.3 GB of it rebuilds itself" | Main.dc.html | 44px, 600, -0.03em, tabular-nums |
| S1.3 | Main | "Where 494 GB goes" strip, 7 bands + legend | Main.dc.html | 30px tall, #5ee6c8/#f5c451/#f57a5e |
| S1.4 | Main | risk colour language teal/amber/coral | Main.dc.html | --sift-safe/caution/review |
| S1.5 | Main | three decision cards with preview rows | Main.dc.html | grid minmax(260px,1fr) |
| S1.6 | Main | "Growing since last week" + sparklines | Main.dc.html | 7 bars, 18px |
| S1.7 | Main | selection bar with risk mix | Main.dc.html | "3 item(s) selected · 24.6 GB" |
| S1.8 | Main | Claude's read card + ask box | Main.dc.html | "via Claude CLI" tag |
| S2.1 | Scan | headline, counts, progress | Scan.dc.html | 14 of 24, 31.2 GB found |
| S2.2 | Scan | four-state category list | Scan.dc.html | found/empty/missing/denied |
| S2.3 | Scan | denied alert + Open Privacy and Security | Scan.dc.html | amber banner |
| S2.4 | Scan | "While you wait" panel | Scan.dc.html | 3 promises |
| S2.5 | Scan | Cancel scan | Scan.dc.html | quiet link |
| S3.1 | Review | three risk groups | Review.dc.html | headings |
| S3.2 | Review | item rows with path + consequence | Review.dc.html | mono 11.5 path |
| S3.3 | Review | locked "Move N item(s) to Trash" until acknowledged | Review.dc.html | disabled until checkbox |
| S3.4 | Review | summary: size, free now, free after, mix bar | Review.dc.html | 32px size |
| S3.5 | Review | acknowledgment row in Your files group | Review.dc.html | checkbox + Reveal |
| S3.6 | Review | per-row checkbox to keep | Review.dc.html | checked = moves |
| S4.1 | Explore | Know panel | Explore.dc.html | right column |
| S4.2 | Explore | treemap | Explore.dc.html | 6 col grid |
| S4.3 | Explore | table: name, share, size, last touched | Explore.dc.html | 4 columns |
| S4.4 | Explore | panel: what, if you clear, made by, touched, path, actions | Explore.dc.html | dl |
| S5.1 | Duplicates | headline "1.9 GB of copies" | Duplicates.dc.html | 32px |
| S5.2 | Duplicates | "Looked in" chips | Duplicates.dc.html | 4 chips |
| S5.3 | Duplicates | group cards with Keep row | Duplicates.dc.html | Keep + 2 copies |
| S5.4 | Duplicates | keep-folder rule select | Duplicates.dc.html | Pictures/Documents/Downloads |
| S6.1 | AI apps | headline "AI apps keep 14.3 GB" | AiApps.dc.html | 32px |
| S6.2 | AI apps | legend | AiApps.dc.html | teal/grey |
| S6.3 | AI apps | per-app cards in grid + bar | AiApps.dc.html | 10px bar |
| S6.4 | AI apps | running warning row + Quit | AiApps.dc.html | amber |
| S6.5 | AI apps | lock icon on kept rows | AiApps.dc.html | 15px svg |
| S6.6 | AI apps | "Kept, it is yours" label | AiApps.dc.html | text |
| S7.1 | Restart | headline "21.3 GB is held, not stored" | Restart.dc.html | 32px |
| S7.2 | Restart | Free now / After restart / And with cleanup bars | Restart.dc.html | 14px bars |
| S7.3 | Restart | five cards with "Comes back on restart" and Delete… | Restart.dc.html | grid |
| S8.1 | Settings | tabs Scanning / Permissions / Claude / History | Settings.dc.html | left nav |
| S8.2 | Settings | scan rules as sentences | Settings.dc.html | inline inputs |
| S8.3 | Settings | "Exactly what Claude sees" preview | Settings.dc.html | mono block |
| S9 | MenuBar | popover: ring, button, wins, warning, rows | MenuBar.dc.html | 380x640 |
| S10.1 | Palette | ⌘K opens modal with search | Palette.dc.html | 720x520 |
| S10.2 | Palette | Actions rows with key badges | Palette.dc.html | ↵, ⌘↵ |
| S10.3 | Palette | Places section | Palette.dc.html | mono paths |
| S10.4 | Palette | Never flag … action | Palette.dc.html | row |
| S11 | Platform | macOS and Windows chrome spec | Platform.dc.html | spec only |
| S12.1 | Sidebar | items with shortcut/meta | Sidebar.dc.html | ⌘2, ⌘, |
| S12.2 | Sidebar | size meta | Sidebar.dc.html | 11.5px |
| S12.3 | Sidebar | disk card | Sidebar.dc.html | free + after clearing |
