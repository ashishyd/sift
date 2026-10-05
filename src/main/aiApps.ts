import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { run } from './exec'
import type { AiAppComponent, AiAppUsage, AiAppsReport, RiskLevel } from '../shared/types'

const home = homedir()
const h = (...parts: string[]): string => join(home, ...parts)

interface ComponentDef {
  id: string
  label: string
  description: string
  path: string
  risk: RiskLevel
  clearable: boolean
}

interface AiAppDef {
  id: string
  label: string
  /** Substring matched against running process paths (e.g. "/Claude.app/"). */
  processMatch: string
  components: ComponentDef[]
}

const cache = (
  id: string,
  label: string,
  path: string,
  description = 'Rebuilt automatically the next time the app runs.'
): ComponentDef => ({ id, label, description, path, risk: 'safe', clearable: true })

/** Folders each app keeps on disk. Chats, logins and settings are listed but never marked clearable. */
export const AI_APP_DEFS: AiAppDef[] = [
  {
    id: 'claude',
    label: 'Claude',
    processMatch: '/Claude.app/',
    components: [
      {
        id: 'vm-bundles',
        label: 'Cowork VM images',
        description:
          'Virtual machine disk images for Claude’s sandboxed agent mode. Re-downloaded the next time you use it.',
        path: h('Library', 'Application Support', 'Claude', 'vm_bundles'),
        risk: 'review',
        clearable: true
      },
      {
        id: 'claude-code-vm',
        label: 'Claude Code VM',
        description: 'Sandbox VM files for Claude Code in the desktop app. Re-created on demand.',
        path: h('Library', 'Application Support', 'Claude', 'claude-code-vm'),
        risk: 'caution',
        clearable: true
      },
      {
        id: 'claude-code-bin',
        label: 'Downloaded Claude Code builds',
        description: 'Old Claude Code versions the desktop app downloaded. The current one is fetched again if needed.',
        path: h('Library', 'Application Support', 'Claude', 'claude-code'),
        risk: 'caution',
        clearable: true
      },
      cache('http-cache', 'Web cache', h('Library', 'Application Support', 'Claude', 'Cache')),
      cache('code-cache', 'Code cache', h('Library', 'Application Support', 'Claude', 'Code Cache')),
      cache('gpu-cache', 'GPU cache', h('Library', 'Application Support', 'Claude', 'GPUCache')),
      cache('dawn-cache', 'Graphics shader cache', h('Library', 'Application Support', 'Claude', 'DawnGraphiteCache')),
      cache('app-cache', 'App caches', h('Library', 'Caches', 'com.anthropic.claudefordesktop')),
      cache('logs', 'Logs', h('Library', 'Logs', 'Claude'), 'Diagnostic logs. Safe to remove.'),
      {
        id: 'agent-sessions',
        label: 'Agent-mode sessions',
        description: 'Working files from past agent-mode sessions.',
        path: h('Library', 'Application Support', 'Claude', 'local-agent-mode-sessions'),
        risk: 'review',
        clearable: true
      },
      {
        id: 'cli-transcripts',
        label: 'Claude Code chat history',
        description: 'Session transcripts in ~/.claude/projects. Deleting removes your ability to resume those sessions.',
        path: h('.claude', 'projects'),
        risk: 'review',
        clearable: false
      },
      {
        id: 'cli-plugins',
        label: 'Claude Code plugins',
        description: 'Installed plugins and marketplaces in ~/.claude/plugins. Removing them uninstalls them.',
        path: h('.claude', 'plugins'),
        risk: 'review',
        clearable: false
      }
    ]
  },
  {
    id: 'cursor',
    label: 'Cursor',
    processMatch: '/Cursor.app/',
    components: [
      {
        id: 'agent-cli',
        label: 'Agent CLI downloads',
        description: 'Downloaded Cursor agent CLI builds (often several old versions). Re-downloaded when the agent next runs.',
        path: h('Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'anysphere.cursor-agent-worker', 'agent-cli'),
        risk: 'caution',
        clearable: true
      },
      cache('vsix', 'Cached extension packages', h('Library', 'Application Support', 'Cursor', 'CachedExtensionVSIXs')),
      cache('cached-data', 'Compiled code cache', h('Library', 'Application Support', 'Cursor', 'CachedData')),
      cache('http-cache', 'Web cache', h('Library', 'Application Support', 'Cursor', 'Cache')),
      cache('code-cache', 'Code cache', h('Library', 'Application Support', 'Cursor', 'Code Cache')),
      cache('gpu-cache', 'GPU cache', h('Library', 'Application Support', 'Cursor', 'GPUCache')),
      cache('logs', 'Logs', h('Library', 'Application Support', 'Cursor', 'logs'), 'Diagnostic logs. Safe to remove.'),
      cache('compile-cache', 'Compile cache', h('Library', 'Caches', 'cursor-compile-cache')),
      cache('app-cache', 'App caches', h('Library', 'Caches', 'com.todesktop.230313mzl4w4u92')),
      {
        id: 'state-db',
        label: 'Chat & editor state',
        description: 'state.vscdb holds your chat history and workspace state. Not removable from here.',
        path: h('Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
        risk: 'review',
        clearable: false
      },
      {
        id: 'state-db-backup',
        label: 'Chat & editor state backup',
        description: 'Automatic backup of state.vscdb. Safe to remove — Cursor rewrites it.',
        path: h('Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb.backup'),
        risk: 'caution',
        clearable: true
      },
      {
        id: 'extensions',
        label: 'Installed extensions',
        description: 'Extensions in ~/.cursor/extensions. Removing them uninstalls them.',
        path: h('.cursor', 'extensions'),
        risk: 'review',
        clearable: false
      },
      {
        id: 'workspace-storage',
        label: 'Per-project state',
        description: 'Workspace storage including per-project chat history.',
        path: h('Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage'),
        risk: 'review',
        clearable: false
      }
    ]
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT & Codex',
    processMatch: '/ChatGPT',
    components: [
      cache('app-cache', 'ChatGPT app caches', h('Library', 'Caches', 'com.openai.chat')),
      cache('atlas-cache', 'Atlas browser caches', h('Library', 'Caches', 'com.openai.atlas')),
      cache('codex-logs', 'Codex logs', h('Library', 'Logs', 'com.openai.codex'), 'Diagnostic logs. Safe to remove.'),
      {
        id: 'chat-data',
        label: 'ChatGPT app data',
        description: 'Local conversations and settings for the ChatGPT desktop app.',
        path: h('Library', 'Application Support', 'com.openai.chat'),
        risk: 'review',
        clearable: false
      },
      {
        id: 'atlas-data',
        label: 'Atlas browser data',
        description: 'ChatGPT Atlas profile: conversations, browsing data and models.',
        path: h('Library', 'Application Support', 'com.openai.atlas'),
        risk: 'review',
        clearable: false
      },
      {
        id: 'codex-home',
        label: 'Codex sessions & config',
        description: 'Session history and settings in ~/.codex.',
        path: h('.codex'),
        risk: 'review',
        clearable: false
      }
    ]
  }
]

async function sizeBytes(p: string): Promise<number> {
  try {
    await fs.stat(p)
  } catch {
    return 0
  }
  const { stdout } = await run('du', ['-sk', p])
  const kb = parseInt(stdout.trim().split(/\s+/)[0] ?? '0', 10)
  return Number.isFinite(kb) ? kb * 1024 : 0
}

async function runningProcessPaths(): Promise<string[]> {
  const { stdout } = await run('ps', ['-axo', 'comm='])
  return stdout.split('\n')
}

export async function scanAiApps(): Promise<AiAppsReport> {
  const procs = await runningProcessPaths()

  const apps: AiAppUsage[] = await Promise.all(
    AI_APP_DEFS.map(async (def) => {
      const sized = await Promise.all(
        def.components.map(async (c): Promise<AiAppComponent> => ({ ...c, sizeBytes: await sizeBytes(c.path) }))
      )
      const components = sized.filter((c) => c.sizeBytes > 0).sort((a, b) => b.sizeBytes - a.sizeBytes)
      const match = procs.find((p) => p.includes(def.processMatch))
      return {
        id: def.id,
        label: def.label,
        running: !!match,
        runningProcessName: match?.match(/\/([^/]+)\.app\//)?.[1] ?? null,
        totalBytes: components.reduce((s, c) => s + c.sizeBytes, 0),
        clearableBytes: components.filter((c) => c.clearable).reduce((s, c) => s + c.sizeBytes, 0),
        components
      }
    })
  )

  return {
    scannedAt: new Date().toISOString(),
    apps,
    totalBytes: apps.reduce((s, a) => s + a.totalBytes, 0),
    clearableBytes: apps.reduce((s, a) => s + a.clearableBytes, 0)
  }
}
