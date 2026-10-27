// Test utilities: a fake command runner, a real throwaway git repo, and a seeded run folder.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { realDeps } from '../scripts/lib/deps.mjs'
import { newRun, writeRun } from '../scripts/lib/run-state.mjs'

export const NOW = new Date('2026-11-01T10:00:00.000Z')

// Rules are [RegExp, result] pairs matched in order against "<cmd> <args>". A result may be a
// function of the line, for commands whose answer changes between calls (polling).
export function fakeDeps({ rules = [], passthrough = [], now = NOW, cwd } = {}) {
  const calls = []
  return {
    calls,
    cwd,
    now: () => now,
    sleep: () => {},
    exec(cmd, args = [], opts = {}) {
      const line = [cmd, ...args].join(' ')
      calls.push(line)
      for (const [re, result] of rules) {
        if (re.test(line)) return { code: 0, stdout: '', stderr: '', ...(typeof result === 'function' ? result(line, opts) : result) }
      }
      if (passthrough.includes(cmd)) return realDeps.exec(cmd, args, opts)
      throw new Error(`unexpected exec: ${line}`)
    },
  }
}

// A temp dir by its real path: macOS hands out /var/..., which git reports as /private/var/...
export const tmpDir = () => realpathSync(mkdtempSync(join(tmpdir(), 'ph3-')))

export function tmpRepo() {
  const dir = tmpDir()
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'README.md'), 'test\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return { dir, git }
}

export const DEFAULT_PHASES = [
  { n: 1, slug: 'setup', type: 'setup' },
  { n: 2, slug: 'api', type: 'build' },
]

export function seedRun(repoDir, { phases = DEFAULT_PHASES, ...overrides } = {}) {
  const runDir = join(repoDir, '.claude', 'phasing', 'demo-run')
  mkdirSync(runDir, { recursive: true })
  const run = { ...newRun({ runId: 'demo-run', repo: repoDir, baseBranch: 'main', phases }, NOW), ...overrides }
  writeRun(runDir, run, NOW)
  return runDir
}

export function writeHandoff(runDir, n, frontmatter, body = '# Handoff\n') {
  const lines = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`)
  writeFileSync(join(runDir, `phase-${n}-handoff.md`), `---\n${lines.join('\n')}\n---\n\n${body}`)
}
