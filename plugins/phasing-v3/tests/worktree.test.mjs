import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { readRun, writeRun } from '../scripts/lib/run-state.mjs'
import { baseFor, createPhaseWorktree, ensureIgnored, main } from '../scripts/worktree.mjs'
import { NOW, fakeDeps, seedRun, tmpRepo } from './helpers.mjs'

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
  assert.deepEqual(first, { branch: 'phase/demo-run/p1-setup', path: `${repo}/.claude/worktrees/demo-run-p1`, created: true })
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
