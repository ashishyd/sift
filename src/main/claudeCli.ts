import { execFile } from 'child_process'
import { run } from './exec'

const CLI_TIMEOUT_MS = 60_000

let cachedPath: string | null | undefined // undefined = not yet resolved this process

/**
 * GUI apps launched from the Dock/Finder get a minimal PATH that usually doesn't include
 * wherever `claude` was installed (~/.local/bin, nvm, homebrew, etc.) — so a plain PATH
 * lookup often fails even when the CLI is installed and logged in. Falling back to the
 * user's own login shell picks up whatever their profile does to extend PATH.
 */
async function findClaudeCliPath(): Promise<string | null> {
  if (cachedPath !== undefined) return cachedPath

  try {
    const { stdout, code } = await run('which', ['claude'])
    const p = stdout.trim()
    if (code === 0 && p) {
      cachedPath = p
      return p
    }
  } catch {
    // fall through to shell lookup
  }

  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const { stdout, code } = await run(shell, ['-ilc', 'command -v claude'])
    const p = stdout.trim().split('\n').filter(Boolean).pop()
    if (code === 0 && p) {
      cachedPath = p
      return p
    }
  } catch {
    // fall through to "not found"
  }

  cachedPath = null
  return null
}

export async function hasClaudeCli(): Promise<boolean> {
  return (await findClaudeCliPath()) !== null
}

interface CliJsonResult {
  result?: string
  is_error?: boolean
}

/** Runs a single one-shot query against the user's local, already-authenticated Claude Code CLI — no Anthropic API key needed. */
export async function runClaudeCli(systemPrompt: string, userPrompt: string): Promise<string> {
  const cliPath = await findClaudeCliPath()
  if (!cliPath) {
    throw new Error('Claude CLI not found. Install Claude Code, or add an API key in Settings.')
  }

  const stdout = await new Promise<string>((resolvePromise, reject) => {
    execFile(
      cliPath,
      [
        '-p',
        userPrompt,
        '--bare',
        '--output-format',
        'json',
        '--system-prompt',
        systemPrompt,
        '--model',
        'haiku'
      ],
      { maxBuffer: 1024 * 1024 * 16, timeout: CLI_TIMEOUT_MS },
      (error, out, stderr) => {
        if (error && !out) {
          reject(new Error(stderr?.trim() || error.message))
          return
        }
        resolvePromise(out)
      }
    )
  })

  let parsed: CliJsonResult
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Claude CLI returned unexpected output')
  }

  if (typeof parsed.result !== 'string') {
    throw new Error('Claude CLI returned no result')
  }
  if (parsed.is_error) {
    throw new Error(parsed.result || 'Claude CLI request failed')
  }

  return parsed.result
}
