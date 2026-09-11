import { execFile } from 'child_process'

export interface ExecResult {
  stdout: string
  stderr: string
  /** null when the process couldn't be spawned at all. */
  code: number | null
}

/** Run a system binary with an argv array (no shell). Never rejects — permission-denied
 * subpaths are common (TCC) and callers need the partial stdout/stderr, not a thrown error. */
export function run(cmd: string, args: string[], opts: { maxBuffer?: number } = {}): Promise<ExecResult> {
  return new Promise((resolvePromise) => {
    execFile(
      cmd,
      args,
      { maxBuffer: opts.maxBuffer ?? 1024 * 1024 * 32 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
        resolvePromise({ stdout, stderr, code })
      }
    )
  })
}

/** macOS TCC (privacy) denials surface as EPERM/EACCES text from `find`/`du` on stderr. */
export function isPermissionError(stderr: string): boolean {
  return /operation not permitted|permission denied/i.test(stderr)
}

export function isPermissionErrno(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  return code === 'EPERM' || code === 'EACCES'
}
