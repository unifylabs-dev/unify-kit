import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decide, main } from '../scripts/continue.mjs'
import { phaseOf, readRun, writeRun } from '../scripts/lib/run-state.mjs'
import { NOW, fakeDeps, seedRun, tmpDir, writeHandoff } from './helpers.mjs'

const WT = '/wt/demo-run-p2'
const ph = overrides => ({ n: 2, slug: 'api', sessions: [], auto_continuations: 0, worktree: WT, ...overrides })
const h = (status, session = 'phase-2-api') => ({ phase: 2, status, blocking_questions: 0, session })
const base = { phase: ph({ auto_continuations: 0 }), handoff: h('partial', 'phase-2-api'), commitsSinceStart: 3, hadInput: false, humanLaunch: false }

test('a partial handoff with progress launches and counts', () => assert.deepEqual(decide(base), { action: 'launch', reason: 'ok', count: 1 }))
test('complete or failed handoffs never continue', () => assert.equal(decide({ ...base, handoff: h('complete') }).reason, 'not-partial'))
test('an open blocking question holds the continuation', () =>
  assert.equal(decide({ ...base, handoff: { ...h('partial'), blocking_questions: 1 } }).reason, 'blocking-question-open'))
test('no commits since the session started is no progress', () => assert.equal(decide({ ...base, commitsSinceStart: 0 }).reason, 'no-progress'))
test('the third automatic continuation stops', () => assert.equal(decide({ ...base, phase: ph({ auto_continuations: 2 }) }).reason, 'cap-reached'))
test('input from the user resets the count', () =>
  assert.deepEqual(decide({ ...base, phase: ph({ auto_continuations: 2 }), hadInput: true }), { action: 'launch', reason: 'ok', count: 1 }))
test('a launch the user asked for skips cap and progress', () =>
  assert.deepEqual(decide({ ...base, phase: ph({ auto_continuations: 2 }), commitsSinceStart: 0, humanLaunch: true }), { action: 'launch', reason: 'ok', count: 0 }))

function seed() {
  const runDir = seedRun(tmpDir())
  const run = readRun(runDir)
  Object.assign(phaseOf(run, 2), { worktree: WT, branch: 'phase/demo-run/p2-api', status: 'running',
    sessions: [{ name: 'phase-2-api', id: 'old00000', started_at: '2026-11-01T09:00:00.000Z', auto: false }] })
  writeRun(runDir, run, NOW)
  writeHandoff(runDir, 2, { phase: 2, status: 'partial', blocking_questions: 0, session: 'phase-2-api' })
  return runDir
}

const agent = (name, state, id) => ({ id, cwd: WT, kind: 'background', startedAt: 1, sessionId: `${id}-x`, name, state })

function deps(commits) {
  let launched = false
  const writer = agent('phase-2-api', 'blocked', 'old00000')
  return fakeDeps({ rules: [
    [/^git -C \/wt\/demo-run-p2 rev-list --count --since=2026-11-01T09:00:00.000Z HEAD/, { stdout: `${commits}\n` }],
    [/^claude --bg/, () => { launched = true; return { stdout: 'new11111\n' } }],
    [/^claude agents --json/, () => ({ stdout: JSON.stringify(launched ? [writer, agent('phase-2-api-c1', 'working', 'new11111')] : [writer]) })],
  ] })
}

test('main launches with the writer excluded and saves the count', () => {
  const runDir = seed()
  const result = main([runDir, '2'], deps(2))
  assert.equal(result.action, 'launch')
  const phase = phaseOf(readRun(runDir), 2)
  assert.equal(phase.auto_continuations, 1)
  assert.deepEqual([phase.sessions[1].name, phase.sessions[1].auto], ['phase-2-api-c1', true])
})

test('main stops without launching and still returns the manual command', () => {
  const runDir = seed()
  const d = deps(0)
  const result = main([runDir, '2'], d)
  assert.deepEqual([result.action, result.reason], ['stop', 'no-progress'])
  assert.ok(result.manual.includes('/ph3-execute demo-run 2'))
  assert.equal(d.calls.some(c => c.startsWith('claude --bg')), false)
  assert.equal(phaseOf(readRun(runDir), 2).auto_continuations, 0)
})
