import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { readRun } from '../scripts/lib/run-state.mjs'
import { isStale, listRuns, main, renderList, renderRun, waitingOn } from '../scripts/status.mjs'
import { NOW, fakeDeps, seedRun, tmpDir } from './helpers.mjs'

const ph = overrides => ({ n: 1, slug: 'setup', type: 'setup', status: 'pending', verified: false, branch: null, worktree: null,
  pr: null, pr_state: null, ci: null, sessions: [], auto_continuations: 0, ...overrides })

test('waitingOn names who the phase waits for', () => {
  assert.equal(waitingOn(ph({ status: 'running' })), 'Claude')
  assert.equal(waitingOn(ph({ status: 'running' }), ['session-waiting-for-input']), 'user: answer in agent view')
  assert.equal(waitingOn(ph({ status: 'partial' })), 'continuation')
  assert.equal(waitingOn(ph({ status: 'complete', verified: false })), 'user: /ph3-next')
  assert.equal(waitingOn(ph({ status: 'failed' })), 'user: decide')
  assert.equal(waitingOn(ph({ status: 'complete', verified: true })), '—')
})

test('renderRun shows PR and CI per phase, then the flags', () => {
  const run = readRun(seedRun(tmpDir()))
  run.phases[1] = { ...run.phases[1], status: 'running', pr: 12, ci: 'pass' }
  const text = renderRun(run, [{ n: 2, code: 'unpushed-commits', detail: '3 commits on x are not pushed' }], { kind: 'wait', n: 2 })
  assert.ok(text.includes('| 2 | build | running | #12 pass | Claude |'), text)
  assert.ok(text.includes('3 commits on x are not pushed'))
  assert.ok(text.includes('next: wait 2'))
})

test('listRuns skips archive and marks old-format runs', () => {
  const repo = tmpDir()
  seedRun(repo)
  const legacy = join(repo, '.claude', 'phasing', 'legacy-run')
  mkdirSync(legacy, { recursive: true })
  writeFileSync(join(legacy, 'run.json'), JSON.stringify({ overall_status: 'in_progress' }))
  mkdirSync(join(repo, '.claude', 'phasing', 'archive', '2026', 'old'), { recursive: true })
  const runs = listRuns(repo).sort((a, b) => a.runId.localeCompare(b.runId))
  assert.deepEqual(runs.map(r => [r.runId, r.format]), [['demo-run', 'v3'], ['legacy-run', 'old']])
  assert.ok(renderList(runs.map(r => ({ ...r, next: { kind: 'launch', n: 1 }, last: NOW })), NOW).includes('legacy-run: old format: use /phase-status'))
})

test('stale after 7 days idle', () => {
  assert.equal(isStale(new Date('2026-10-24T09:59:00Z'), NOW), true)
  assert.equal(isStale(new Date('2026-10-26T10:00:00Z'), NOW), false)
  const text = renderList([{ runId: 'demo-run', format: 'v3', status: 'in_progress', run: { status: 'in_progress' }, next: { kind: 'verify', n: 1 }, last: new Date('2026-10-20T10:00:00Z') }], NOW)
  assert.ok(text.includes('stale (idle 12d)'), text)
})

test('status never writes run.json', () => {
  const repo = tmpDir()
  const runDir = seedRun(repo)
  const file = join(runDir, 'run.json')
  const before = [readFileSync(file, 'utf8'), statSync(file).mtimeMs]
  const out = main(['demo-run', '--repo', repo], fakeDeps({ rules: [[/^git remote/, { stdout: '' }], [/^claude agents/, { stdout: '[]' }]] }))
  assert.ok(out.text.includes('| 1 | setup | pending |'))
  assert.deepEqual([readFileSync(file, 'utf8'), statSync(file).mtimeMs], before)
})

const quiet = () => fakeDeps({ rules: [[/^git remote/, { stdout: '' }], [/^claude agents/, { stdout: '[]' }]] })

test('one broken run does not hide the others', () => {
  const repo = tmpDir()
  seedRun(repo)
  const bad = join(repo, '.claude', 'phasing', 'bad-run')
  mkdirSync(bad, { recursive: true })
  writeFileSync(join(bad, 'run.json'), JSON.stringify({ schema: 'phasing-v3/1', run_id: 'bad-run', status: 'in_progress' }))
  const out = main(['--repo', repo], quiet())
  assert.ok(out.text.includes('demo-run: next launch 1'), out.text)
  assert.match(out.text, /bad-run: unreadable run\.json/)
})

test('finished old-format runs drop out; an old or missing run id gets a pointer', () => {
  const repo = tmpDir()
  for (const [id, status] of [['legacy-live', 'in_progress'], ['legacy-done', 'complete']]) {
    mkdirSync(join(repo, '.claude', 'phasing', id), { recursive: true })
    writeFileSync(join(repo, '.claude', 'phasing', id, 'run.json'), JSON.stringify({ overall_status: status }))
  }
  const list = main(['--repo', repo], quiet()).text
  assert.ok(list.includes('legacy-live') && !list.includes('legacy-done'), list)
  assert.match(main(['legacy-live', '--repo', repo], quiet()).text, /old format: use \/phase-status/)
  assert.match(main(['gone-run', '--repo', repo], quiet()).text, /no run gone-run/)
})

test('parked runs are not reconciled', () => {
  const repo = tmpDir()
  seedRun(repo, { status: 'parked', reason: 'waiting' })
  assert.equal(main(['--repo', repo], fakeDeps()).text, 'No runs in flight in this repo.')
})

test('flag lines name their phase, and next is optional', () => {
  const run = readRun(seedRun(tmpDir()))
  const text = renderRun(run, [{ n: 2, code: 'status-changed', detail: 'pending→complete' }])
  assert.ok(text.includes('- phase 2: pending→complete'), text)
  assert.ok(text.includes('next: launch 1'))
})

test('bare --repo is a usage error', () => assert.throws(() => main(['--repo'], quiet()), /--repo/))
