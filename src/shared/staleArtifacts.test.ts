import { describe, expect, it } from 'vitest'
import { artifactKind, isExcludedLocation, needsGitIgnore, restoreHint } from './staleArtifacts'

describe('artifactKind', () => {
  it('needs the ecosystem marker beside the folder', () => {
    expect(artifactKind('node_modules', ['package.json'])).toBe('js')
    expect(artifactKind('node_modules', ['README.md'])).toBeNull()
    expect(artifactKind('target', ['Cargo.toml'])).toBe('rust')
    expect(artifactKind('target', ['package.json'])).toBeNull()
    expect(artifactKind('.venv', ['pyproject.toml'])).toBe('python')
    expect(artifactKind('build', ['package.json'])).toBeNull()
  })
  it('asks for git-ignore proof only for names that are often committed', () => {
    expect(['dist', 'target', '.next', '.nuxt'].every(needsGitIgnore)).toBe(true)
    expect(needsGitIgnore('node_modules')).toBe(false)
  })
})

describe('restoreHint', () => {
  it('follows the lockfile', () => {
    expect(restoreHint('node_modules', ['package.json', 'pnpm-lock.yaml'])).toBe('pnpm install')
    expect(restoreHint('node_modules', ['yarn.lock'])).toBe('yarn install')
    expect(restoreHint('node_modules', ['package.json'])).toBe('npm install')
    expect(restoreHint('.next', ['pnpm-lock.yaml'])).toBe('pnpm run build')
    expect(restoreHint('target', ['Cargo.toml'])).toBe('cargo build')
    expect(restoreHint('.venv', ['uv.lock'])).toBe('uv sync')
    expect(restoreHint('.venv', ['requirements.txt'])).toContain('pip install -r requirements.txt')
  })
})

describe('isExcludedLocation', () => {
  const home = '/Users/me'
  it('skips tool caches, Library and hidden ancestors', () => {
    expect(isExcludedLocation('/Users/me/.nvm/versions/node/v22/lib/node_modules', home)).toBe(true)
    expect(isExcludedLocation('/Users/me/.vscode/extensions/x/node_modules', home)).toBe(true)
    expect(isExcludedLocation('/Users/me/Library/Application Support/a/node_modules', home)).toBe(
      true
    )
  })
  it('keeps normal projects, including dot-named artefacts', () => {
    expect(isExcludedLocation('/Users/me/dev/app/node_modules', home)).toBe(false)
    expect(isExcludedLocation('/Users/me/dev/app/.venv', home)).toBe(false)
    expect(isExcludedLocation('/Users/me/dev/app/.next', home)).toBe(false)
  })
})
