import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { archive, main, setStatus } from '../scripts/closeout.mjs'
import { createPhaseWorktree } from '../scripts/worktree.mjs'
import { NOW, fakeDeps, seedRun, tmpRepo } from './helpers.mjs'

const gitDeps = () => fakeDeps({ passthrough: ['git'] })

test('park and abandon need a reason', () => {
  const { dir } = tmpRepo()
  const runDir = seedRun(dir)
  assert.throws(() => setStatus(runDir, 'parked', '', NOW), /reason/)
  assert.throws(() => setStatus(runDir, 'in_progress', null, NOW), /status/)
  assert.equal(setStatus(runDir, 'parked', 'waiting on client copy', NOW).reason, 'waiting on client copy')
})

test('archive refuses a run in progress', () => {
  const { dir } = tmpRepo()
  assert.throws(() => archive(seedRun(dir), gitDeps()), /in_progress/)
})

test('archive removes clean worktrees, skips dirty ones, and moves the folder', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const p1 = createPhaseWorktree(runDir, 1, 'main', gitDeps()).path
  const p2 = createPhaseWorktree(runDir, 2, 'main', gitDeps()).path
  writeFileSync(join(p2, 'scratch.txt'), 'uncommitted\n')
  setStatus(runDir, 'complete', null, NOW)
  const r = archive(runDir, gitDeps())
  assert.deepEqual(r.removed, [p1])
  assert.equal(r.skipped[0].path, p2)
  assert.ok(r.skipped[0].reason.length > 0)
  assert.equal(r.archivedTo, join(repo, '.claude', 'phasing', 'archive', '2026', 'demo-run'))
  assert.equal(existsSync(runDir), false)
  assert.equal(existsSync(join(r.archivedTo, 'run.json')), true)
})

test('archive refuses an existing target before touching anything', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const p1 = createPhaseWorktree(runDir, 1, 'main', gitDeps()).path
  setStatus(runDir, 'abandoned', 'superseded', NOW)
  mkdirSync(join(repo, '.claude', 'phasing', 'archive', '2026', 'demo-run'), { recursive: true })
  assert.throws(() => archive(runDir, gitDeps()), /exists/)
  assert.equal(existsSync(p1), true)
})

test('CLI status and archive', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  assert.equal(main(['status', runDir, 'complete_unmet'], gitDeps()).status, 'complete_unmet')
  assert.throws(() => main(['status', runDir, 'parked'], gitDeps()), /reason/)
  assert.ok(main(['archive', runDir], gitDeps()).archivedTo.endsWith('/archive/2026/demo-run'))
})
