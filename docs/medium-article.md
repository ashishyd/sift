# Where Did My 200 GB Go? I Built Sift to Find Out (and Clean It Up Safely)

*Know before you clear: an open-source, AI-assisted storage cleaner for macOS developers.*

<!-- IMAGE: hero screenshot of the Sift dashboard with the Top actions list -->

If you write code on a Mac, you've probably seen this: "Your disk is almost full."

You haven't downloaded a movie library. You haven't shot hours of 4K video. Yet your 512 GB drive is gone, and the culprit is a pile of things you never chose to keep: Xcode DerivedData, old simulator runtimes, `node_modules` folders from projects you abandoned in 2023, Docker images, package manager caches, and a growing pile of AI app data.

I got tired of this cycle, so I built **Sift**.

## The problem with existing cleaners

I tried the usual tools. They all have the same two issues:

**1. They guess, and they hide the risk.** A button says "Clean 38 GB" and you're asked to trust it. As a developer, I want to know *what* is going away. Is that cache safe to clear, or will it cost me a 40-minute rebuild? Is that folder a cache, or my only copy of something?

**2. They don't understand developer machines.** Generic cleaners know about browser caches and system logs. They don't know that an old iOS simulator runtime can be 7 GB, that Xcode `iOS DeviceSupport` folders pile up with every device you plug in, or that Cargo, Gradle, pnpm and CocoaPods each keep their own multi-gigabyte caches.

I wanted something that answered one question honestly: **what is safe to remove, and how much space will I really get back?**

That's the idea behind the tagline: *Know before you clear.*

## What Sift does

Sift scans the places a Mac and its dev tools quietly fill up, ranks what's safe to clear against what needs a second look, and tells you the real space you'll recover.

<!-- IMAGE: Explore view with size-sorted folders and risk labels -->

### Ranked actions with risk labels

The Dashboard shows a single **Top actions** list, sorted by space freed and by how confident Sift is that it's safe. Every category is labeled `safe`, `caution` or `review`, so you know before you click.

It covers app and browser caches, Xcode DerivedData, Archives and DeviceSupport, simulator caches and runtimes, npm/pnpm/yarn, Gradle/Cargo/pip/CocoaPods, the Homebrew cache, Docker Desktop data, old Downloads and disk images, iOS backups, stray `node_modules`, large unused files, and more.

### Reclaim space without restarting

This is my favorite part. A restart often frees gigabytes on a Mac, but you shouldn't have to reboot to get that. The **Restart space** tab shows where that space is hiding:

- **Deleted files still held open.** You emptied the Trash, but the space didn't come back, because an app still holds the file. Sift shows which app and lets you quit it.
- **Memory swap.** See how much swap is on disk and which apps are using the most memory.
- **Simulator runtimes.** List installed iOS and tvOS runtimes with size and last-used date, and delete the ones you no longer test on.
- **Time Machine local snapshots.** See and remove on-disk restore points.

### Track your AI apps

AI tools are now a real source of disk usage. The **AI Apps** tab shows how much space Claude, Cursor and ChatGPT/Codex use, split into caches, logs, VM images, downloaded builds and history. Caches and VM images can go; chat history, extensions and login state are marked "keep".

### Plain-English advice from Claude (optional)

Sift can ask Claude to turn a scan into a verdict per category: `clear it`, `review first` or `keep`. You can ask follow-up questions about a specific file or folder.

It works with your own Anthropic API key, or with your already logged-in Claude Code CLI. And if you want no AI at all, Sift falls back to a transparent, rule-based summary and tells you that's what you're seeing. Every response is labeled with its source.

### Low-space alerts and a menu bar companion

Sift sends a macOS notification when free space drops below a limit you choose, 20 GB by default. A menu bar item shows reclaimable space at a glance and rescans in the background. When you close the window it frees its renderer process, so it sits there using very little memory.

### More

- **Duplicate finder** for exact-content duplicates in Desktop, Documents, Downloads and Pictures. You choose which copy to keep.
- **Ignore list** so items you've decided to keep don't come back on every scan.
- **Clear history** with a running lifetime total of what you've freed.

## Safety was the design constraint

A cleanup tool that deletes the wrong thing is worse than no tool. So Sift is built around a few rules:

- **Trash first.** Most clears go through the macOS Trash, so you can restore anything until you empty it yourself.
- **Permanent actions are separate and always ask first.** Emptying the Trash, deleting a simulator runtime and deleting Time Machine snapshots are called out explicitly.
- **Every clear is confirmed** with a native dialog showing the item count and size before anything moves.
- **Honest about permissions.** macOS blocks access to many folders unless you grant it. Sift knows the difference between "this folder is empty" and "I couldn't read this folder", and tells you which one it is. It never shows "0 items" and lets you assume that means clean.

## Privacy: your files stay on your Mac

Scanning, hashing and cleanup all happen locally. If you enable the Claude integration, only category labels, sizes, item counts and a few example filenames are sent. **Never file contents.** Your API key is encrypted at rest using the macOS Keychain.

## How it's built

Sift is an Electron app (`electron-vite`) with React 19, TypeScript, Tailwind CSS v4, Zustand and Recharts, with Vitest for tests. The scanner uses well-known cache and build locations plus `du`, `find` and file metadata, so it works fully offline.

<!-- OPTIONAL: add a short personal story here, e.g. how much space you recovered on your own Mac the first time you ran it -->

## Try it

Sift is free, open source (MIT), and macOS only. It isn't a signed download yet, so you build it from source in a few minutes. You need Node.js 22+ and pnpm 10+.

```bash
git clone https://github.com/ashishyd/sift.git
cd sift
pnpm install
pnpm dist:mac
```

That builds the app and installs **Sift.app** into `/Applications`. Because it isn't notarized, right-click the app and choose **Open** the first time.

Then click **Scan my Mac**, and for the most complete results grant Full Disk Access when Sift prompts you.

## Help shape it

Sift is young, and I'd love your feedback: bugs, missing categories, dev tools I should add to the scanner. Issues and pull requests are welcome.

**GitHub: [github.com/ashishyd/sift](https://github.com/ashishyd/sift)**

If it helps you reclaim some space, a ⭐ on the repo goes a long way.

---

*Tags: macOS, Developer Tools, Open Source, Productivity, Xcode*
