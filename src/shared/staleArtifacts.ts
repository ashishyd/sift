export type ArtifactKind = 'js' | 'rust' | 'python'

export const ARTIFACT_DIR_NAMES = [
  'node_modules',
  '.next',
  '.nuxt',
  'dist',
  'target',
  '.venv',
  'venv'
]

/** Generated-by-convention names that could also be committed: only trust them if git ignores them. */
export function needsGitIgnore(dirName: string): boolean {
  return ['dist', '.next', '.nuxt', 'target'].includes(dirName)
}

/** Which ecosystem an artefact dir belongs to, judged by marker files in its parent. Null = not ours. */
export function artifactKind(dirName: string, parentFiles: string[]): ArtifactKind | null {
  const has = (...names: string[]): boolean => names.some((n) => parentFiles.includes(n))
  if (['node_modules', '.next', '.nuxt', 'dist'].includes(dirName)) {
    return has('package.json') ? 'js' : null
  }
  if (dirName === 'target') return has('Cargo.toml') ? 'rust' : null
  if (dirName === '.venv' || dirName === 'venv') {
    return has('pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile') ? 'python' : null
  }
  return null
}

/** The command that brings the folder back, shown on the row so "clear" is a known trade. */
export function restoreHint(dirName: string, parentFiles: string[]): string {
  const has = (n: string): boolean => parentFiles.includes(n)
  if (dirName === 'target') return 'cargo build'
  if (dirName === '.venv' || dirName === 'venv') {
    if (has('uv.lock')) return 'uv sync'
    if (has('poetry.lock')) return 'poetry install'
    if (has('requirements.txt')) return 'python -m venv .venv && pip install -r requirements.txt'
    return 'python -m venv .venv && pip install -e .'
  }
  const pm = has('pnpm-lock.yaml')
    ? 'pnpm'
    : has('yarn.lock')
      ? 'yarn'
      : has('bun.lockb') || has('bun.lock')
        ? 'bun'
        : 'npm'
  return dirName === 'node_modules' ? `${pm} install` : `${pm} run build`
}

/** Tools and caches keep their own node_modules / venvs under dot-folders and Library; never touch them. */
export function isExcludedLocation(path: string, home: string): boolean {
  const rel = path.startsWith(home + '/') ? path.slice(home.length + 1) : path
  const segments = rel.split('/').filter(Boolean)
  // The artefact's own name may start with a dot (.venv, .next); its ancestors may not.
  return segments
    .slice(0, -1)
    .some((s) => s.startsWith('.') || s === 'Library' || s === 'Applications')
}
