import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { readRun, writeRun } from '../scripts/lib/run-state.mjs'
import { baseFor, createPhaseWorktree, ensureIgnored, main } from '../scripts/worktree.mjs'
import { NOW, fakeDeps, seedRun, tmpDir, tmpRepo } from './helpers.mjs'

const gitDeps = () => fakeDeps({ passthrough: ['git'] })

function run2({ prState }) {
  const { dir } = tmpRepo()
  const r = readRun(seedRun(dir))
  r.phases[0] = { ...r.phases[0], branch: 'phase/demo-run/p1-setup', pr_state: prState }
  return r
}

test('createPhaseWorktree makes the branch and worktree, records them, and is idempotent', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const deps = gitDeps()
  const first = createPhaseWorktree(runDir, 1, 'main', deps)
  assert.deepEqual(first, { branch: 'phase/demo-run/p1-setup', path: `${repo}/.claude/worktrees/demo-run-p1`, created: true, base: 'main' })
  assert.equal(readRun(runDir).phases[0].worktree, first.path)
  assert.equal(readRun(runDir).phases[0].branch, first.branch)
  assert.equal(createPhaseWorktree(runDir, 1, 'main', deps).created, false)
})

test('an existing branch without a worktree is checked out, not recreated', () => {
  const { dir: repo, git } = tmpRepo()
  const runDir = seedRun(repo)
  git('branch', 'phase/demo-run/p1-setup')
  const r = createPhaseWorktree(runDir, 1, 'main', gitDeps())
  assert.equal(r.created, true)
  assert.equal(git('-C', r.path, 'branch', '--show-current'), 'phase/demo-run/p1-setup')
})

test('ensureIgnored writes the exclude line once', () => {
  const { dir: repo } = tmpRepo()
  const deps = gitDeps()
  assert.equal(ensureIgnored(repo, deps), true)
  assert.equal(ensureIgnored(repo, deps), false)
  assert.match(readFileSync(`${repo}/.git/info/exclude`, 'utf8'), /^\.claude\/worktrees\/$/m)
})

test('baseFor stacks on an unmerged previous phase', () => {
  assert.equal(baseFor(run2({ prState: null }), 1), 'main')
  assert.equal(baseFor(run2({ prState: 'MERGED' }), 2), 'main')
  assert.equal(baseFor(run2({ prState: 'OPEN' }), 2), 'phase/demo-run/p1-setup')
})

test('CLI create defaults to baseFor and prints the result', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const r = readRun(runDir)
  writeRun(runDir, r, NOW)
  assert.equal(main(['create', runDir, '1'], gitDeps()).branch, 'phase/demo-run/p1-setup')
})

test('the base branch comes from the remote, so a merge done on GitHub is included', () => {
  const origin = tmpDir()
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  const { dir: repo, git } = tmpRepo()
  git('remote', 'add', 'origin', origin)
  git('push', '-q', 'origin', 'main')
  const other = tmpDir()
  execFileSync('git', ['clone', '-q', origin, other])
  writeFileSync(join(other, 'merged.txt'), 'merged on the remote\n')
  const g = (...a) => execFileSync('git', ['-C', other, '-c', 'user.email=t@example.com', '-c', 'user.name=T', ...a])
  g('add', '.'); g('commit', '-q', '-m', 'merge'); g('push', '-q', 'origin', 'main')
  const r = createPhaseWorktree(seedRun(repo), 1, 'main', gitDeps())
  assert.ok(existsSync(join(r.path, 'merged.txt')))
  // The phase branch does not track origin/main, so a bare `git push` cannot land on main.
  const upstream = spawnSync('git', ['-C', r.path, 'rev-parse', '--abbrev-ref', '@{upstream}'], { encoding: 'utf8' })
  assert.notEqual(upstream.stdout.trim(), 'origin/main')
})

test('a leftover plain folder is reported; a stale registration is pruned', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const path = join(repo, '.claude', 'worktrees', 'demo-run-p1')
  mkdirSync(path, { recursive: true })
  assert.throws(() => createPhaseWorktree(runDir, 1, 'main', gitDeps()), /not a git worktree/)
  rmSync(path, { recursive: true })
  createPhaseWorktree(runDir, 1, 'main', gitDeps())
  rmSync(path, { recursive: true, force: true })
  assert.equal(createPhaseWorktree(runDir, 1, 'main', gitDeps()).created, true)
})

test('--base with no value is a usage error', () => {
  const { dir: repo } = tmpRepo()
  assert.throws(() => main(['create', seedRun(repo), '1', '--base'], gitDeps()), /--base/)
})

test('createPhaseWorktree reports the PR base: the base branch, or the stacked branch', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  assert.equal(createPhaseWorktree(runDir, 1, 'main', gitDeps()).base, 'main')
  assert.equal(createPhaseWorktree(runDir, 2, 'phase/demo-run/p1-setup', gitDeps()).base, 'phase/demo-run/p1-setup')
})
