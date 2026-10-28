import assert from 'node:assert/strict'
import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

import { realDeps } from '../scripts/lib/deps.mjs'
import { newRun, readHandoff, readRun, validateRun, writeRun } from '../scripts/lib/run-state.mjs'
import { main } from '../scripts/run-state.mjs'
import { NOW, fakeDeps, seedRun, tmpDir, tmpRepo, writeHandoff } from './helpers.mjs'

test('newRun seeds pending phases', () => {
  const run = newRun({ runId: 'demo-run', repo: '/r', baseBranch: 'main',
    phases: [{ n: 1, slug: 'setup', type: 'setup' }, { n: 2, slug: 'api', type: 'build' }] }, NOW)
  assert.equal(run.schema, 'phasing-v3/1')
  assert.equal(run.status, 'in_progress')
  assert.deepEqual(run.phases[1], { n: 2, slug: 'api', type: 'build', status: 'pending', verified: false,
    branch: null, worktree: null, pr: null, pr_state: null, pr_base: null, ci: null, sessions: [], auto_continuations: 0 })
  assert.equal(run.created_at, '2026-11-01T10:00:00.000Z')
})

test('validateRun rejects bad names, types and phase gaps', () => {
  const bad = newRun({ runId: 'demo-run', repo: '/r', baseBranch: 'main',
    phases: [{ n: 1, slug: 'café', type: 'research' }, { n: 3, slug: 'ok', type: 'build' }] }, NOW)
  bad.run_id = 'Demo Run'
  const errors = validateRun(bad).join('\n')
  for (const word of ['run_id', 'slug', 'type', 'phase numbers']) assert.match(errors, new RegExp(word))
})

test('writeRun is atomic and stamps updated_at', () => {
  const runDir = seedRun(tmpDir())
  const later = new Date('2026-11-02T08:30:00.000Z')
  writeRun(runDir, readRun(runDir), later)
  assert.deepEqual(readdirSync(runDir).filter(f => f.endsWith('.tmp')), [])
  assert.equal(readRun(runDir).updated_at, later.toISOString())
})

test('readHandoff parses frontmatter', () => {
  const runDir = seedRun(tmpDir())
  writeHandoff(runDir, 3, { phase: 3, status: 'partial', blocking_questions: 0, session: '"phase-3-api-c1"' })
  assert.deepEqual(readHandoff(runDir, 3), { phase: 3, status: 'partial', blocking_questions: 0, session: 'phase-3-api-c1' })
})

test('readHandoff: no file is null, broken frontmatter is invalid', () => {
  const runDir = seedRun(tmpDir())
  assert.equal(readHandoff(runDir, 1), null)
  writeHandoff(runDir, 1, { phase: 1, status: 'done', blocking_questions: 0, session: 'phase-1-setup' })
  const wrongStatus = readHandoff(runDir, 1)
  assert.equal(wrongStatus.status, 'invalid')
  assert.match(wrongStatus.error, /status/)
  writeFileSync(join(runDir, 'phase-2-handoff.md'), '# Handoff with no frontmatter\n')
  assert.equal(readHandoff(runDir, 2).status, 'invalid')
})

test('CLI mark-verified sets verified on one phase only', () => {
  const runDir = seedRun(tmpDir())
  const run = readRun(runDir)
  run.phases[1].status = 'complete'
  writeRun(runDir, run, NOW)
  main(['mark-verified', runDir, '2'], fakeDeps())
  const after = readRun(runDir)
  assert.equal(after.phases[1].verified, true)
  assert.equal(after.phases[0].verified, false)
  assert.throws(() => main(['mark-verified', runDir, '1'], fakeDeps()), /not complete/)
})

test('CLI locate finds the run dir from a phase worktree', () => {
  const { dir, git } = tmpRepo()
  seedRun(dir)
  const wt = join(dir, '.claude', 'worktrees', 'demo-run-p1')
  git('worktree', 'add', '-q', '-b', 'phase/demo-run/p1-setup', wt)
  assert.deepEqual(main(['locate', 'demo-run'], { ...realDeps, cwd: wt }), { runDir: join(dir, '.claude', 'phasing', 'demo-run') })
})

test('init stores an absolute repo and refuses a run dir off the standard path', () => {
  const repo = tmpDir()
  const phases = JSON.stringify([{ n: 1, slug: 'setup', type: 'setup' }])
  const args = runDir => ['init', runDir, '--run-id', 'demo-run', '--base', 'main', '--phases', phases]
  assert.throws(() => main([...args(join(repo, 'elsewhere')), '--repo', repo], fakeDeps()), /\.claude\/phasing\/demo-run/)
  const out = main([...args(join(repo, '.claude', 'phasing', 'demo-run')), '--repo', relative(process.cwd(), repo)], fakeDeps())
  assert.equal(out.repo, repo)
  assert.match(validateRun({ ...out, repo: '.' }).join('\n'), /absolute/)
})

test('readHandoff reads top-level keys only and rejects duplicates and blank numbers', () => {
  const runDir = seedRun(tmpDir())
  const file = join(runDir, 'phase-1-handoff.md')
  writeFileSync(file, '---\nphase: 1\nstatus: partial\nblocking_questions: 0\nsession: phase-1-setup\nnotes:\n  status: complete\n---\n')
  assert.equal(readHandoff(runDir, 1).status, 'partial')
  writeFileSync(file, '---\nphase: 1\nstatus: partial\nstatus: complete\nblocking_questions: 0\nsession: phase-1-setup\n---\n')
  assert.match(readHandoff(runDir, 1).error, /duplicate/)
  writeFileSync(file, '---\nphase: 1\nstatus: partial\nblocking_questions: " "\nsession: phase-1-setup\n---\n')
  assert.equal(readHandoff(runDir, 1).status, 'invalid')
})

test('readHandoff accepts the phase number as a string', () => {
  const runDir = seedRun(tmpDir())
  writeHandoff(runDir, 3, { phase: 3, status: 'partial', blocking_questions: 0, session: 'phase-3-api' })
  assert.equal(readHandoff(runDir, '3').status, 'partial')
})

test('writeRun refuses a run that changed on disk since it was read', () => {
  const runDir = seedRun(tmpDir())
  const a = readRun(runDir)
  const b = readRun(runDir)
  writeRun(runDir, a, NOW)
  assert.throws(() => writeRun(runDir, b, NOW), /changed on disk/)
})
