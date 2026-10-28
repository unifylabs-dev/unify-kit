import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { archive, main, setStatus } from '../scripts/closeout.mjs'
import { createPhaseWorktree } from '../scripts/worktree.mjs'
import { NOW, fakeDeps, seedRun, tmpRepo } from './helpers.mjs'
import { readRun, writeRun } from '../scripts/lib/run-state.mjs'

const gitDeps = (rules = [[/^claude agents/, { stdout: '[]' }]]) => fakeDeps({ passthrough: ['git'], rules })

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

test('archive keeps a worktree whose ignored files would be lost', () => {
  const { dir: repo, git } = tmpRepo()
  writeFileSync(join(repo, '.gitignore'), '.env.local\nnode_modules/\n')
  git('add', '.gitignore'); git('commit', '-q', '-m', 'ignore')
  const runDir = seedRun(repo)
  const p1 = createPhaseWorktree(runDir, 1, 'main', gitDeps()).path
  const p2 = createPhaseWorktree(runDir, 2, 'main', gitDeps()).path
  writeFileSync(join(p1, '.env.local'), 'API_KEY=x\n')
  mkdirSync(join(p2, 'node_modules', 'pkg'), { recursive: true })
  writeFileSync(join(p2, 'node_modules', 'pkg', 'index.js'), '\n')
  setStatus(runDir, 'complete', null, NOW)
  const r = archive(runDir, gitDeps())
  assert.deepEqual(r.removed, [p2])
  assert.match(r.skipped[0].reason, /\.env\.local/)
})

test('archive refuses while a session works, stops idle ones, and needs agent view', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  const p1 = createPhaseWorktree(runDir, 1, 'main', gitDeps()).path
  setStatus(runDir, 'abandoned', 'superseded', NOW)
  const live = state => [[/^claude agents/, { stdout: JSON.stringify([{ id: 'abc', name: 'phase-1-setup', cwd: p1, kind: 'background', state }]) }]]
  assert.throws(() => archive(runDir, gitDeps(live('working'))), /working/)
  assert.throws(() => archive(runDir, gitDeps([[/^claude agents/, { code: 1 }]])), /agent view/)
  const stops = []
  let timeout = 0
  const deps = gitDeps([...live('blocked'),
    [/^claude stop abc/, line => { stops.push(line); return {} }],
    [/worktree remove/, (line, opts) => { timeout = opts.timeoutMs ?? 0; return {} }]])
  const r = archive(runDir, deps)
  assert.deepEqual([stops.length, r.stopped], [1, ['phase-1-setup']])
  assert.ok(timeout >= 300_000, `timeout ${timeout}`)
})

test('parked runs stay in place and can resume', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  setStatus(runDir, 'parked', 'waiting on copy', NOW)
  assert.throws(() => archive(runDir, gitDeps()), /parked/)
  assert.equal(setStatus(runDir, 'in_progress', null, NOW).status, 'in_progress')
  setStatus(runDir, 'complete', null, NOW)
  assert.throws(() => setStatus(runDir, 'in_progress', null, NOW), /parked/)
})

test('the archive sits beside the run folder even if run.json names a moved repo', () => {
  const { dir: repo } = tmpRepo()
  const runDir = seedRun(repo)
  writeRun(runDir, { ...readRun(runDir), repo: '/moved/elsewhere', status: 'complete' }, NOW)
  assert.equal(archive(runDir, fakeDeps()).archivedTo, join(repo, '.claude', 'phasing', 'archive', '2026', 'demo-run'))
})
