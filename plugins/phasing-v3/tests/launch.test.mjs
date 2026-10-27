import assert from 'node:assert/strict'
import { relative } from 'node:path'
import { test } from 'node:test'

import { launch, launchArgs, main, sessionName } from '../scripts/launch.mjs'
import { phaseOf, readRun, writeRun } from '../scripts/lib/run-state.mjs'
import { NOW, fakeDeps, seedRun, tmpDir, writeHandoff } from './helpers.mjs'

const WT = '/wt/demo-run-p2'
const s = name => ({ name, id: 'old00000', started_at: NOW.toISOString(), auto: false })
const agent = (name, state = 'working', id = 'abc12345') => ({ id, cwd: WT, kind: 'background', startedAt: 1, sessionId: `${id}-x`, name, state })

function seed({ worktree = WT, sessions = [] } = {}) {
  const runDir = seedRun(tmpDir())
  const run = readRun(runDir)
  Object.assign(phaseOf(run, 2), { worktree, branch: 'phase/demo-run/p2-api', sessions })
  writeRun(runDir, run, NOW)
  return runDir
}

// Agent view answers `before` until `claude --bg` runs, then `after`.
function agentsDeps(before, after) {
  let launched = false
  return fakeDeps({ rules: [
    [/^claude --bg/, () => { launched = true; return { stdout: 'abc12345\n' } }],
    [/^claude agents --json/, () => ({ stdout: JSON.stringify(launched ? after : before) })],
  ] })
}

test('launchArgs builds the background command', () => {
  const runDir = seed()
  const run = readRun(runDir)
  assert.deepEqual(launchArgs(run, phaseOf(run, 2), runDir, 'phase-2-api'), ['--bg', '--name', 'phase-2-api', '--effort', 'xhigh',
    '--add-dir', runDir, '--settings', '{"worktree":{"bgIsolation":"none"}}', '/ph3-execute demo-run 2'])
})

test('sessionName numbers continuations', () => {
  assert.equal(sessionName({ n: 2, slug: 'api', sessions: [] }), 'phase-2-api')
  assert.equal(sessionName({ n: 2, slug: 'api', sessions: [s('phase-2-api')] }), 'phase-2-api-c1')
})

test('launch confirms via agents json and records the session', () => {
  const runDir = seed()
  const r = launch(runDir, 2, {}, agentsDeps([], [agent('phase-2-api')]))
  assert.equal(r.confirmed, true)
  assert.equal(r.id, 'abc12345')
  const phase = phaseOf(readRun(runDir), 2)
  assert.deepEqual(phase.sessions[0], { name: 'phase-2-api', id: 'abc12345', started_at: NOW.toISOString(), auto: false })
  assert.equal(phase.status, 'running')
})

test('unconfirmed launch records nothing and returns the manual command', () => {
  const runDir = seed()
  const deps = agentsDeps([], [])
  const r = launch(runDir, 2, {}, deps)
  assert.equal(r.confirmed, false)
  assert.deepEqual(phaseOf(readRun(runDir), 2).sessions, [])
  assert.ok(r.manual.startsWith(`cd '${WT}' && claude --bg --name phase-2-api`), r.manual)
  assert.equal(deps.calls.filter(c => c.startsWith('claude agents')).length, 6, 'one live check, then five polls')
})

test('launch refuses a second live session for the phase', () => {
  const runDir = seed({ sessions: [s('phase-2-api')] })
  const deps = agentsDeps([agent('phase-2-api', 'blocked', 'old00000')], [agent('phase-2-api', 'blocked', 'old00000'), agent('phase-2-api-c1')])
  const refused = launch(runDir, 2, {}, deps)
  assert.equal(refused.refused, 'live-session')
  assert.equal(deps.calls.some(c => c.startsWith('claude --bg')), false)
  const handover = launch(runDir, 2, { exclude: ['phase-2-api'], continuation: true }, deps)
  assert.equal(handover.confirmed, true)
  assert.deepEqual(phaseOf(readRun(runDir), 2).sessions.map(x => [x.name, x.auto]), [['phase-2-api', false], ['phase-2-api-c1', true]])
})

test('launch refuses when live sessions cannot be checked', () => {
  const runDir = seed()
  const deps = fakeDeps({ rules: [[/^claude agents/, { code: 1, stderr: 'boom' }]] })
  const r = launch(runDir, 2, {}, deps)
  assert.equal(r.refused, 'agents-unavailable')
  assert.ok(r.manual.includes('/ph3-execute demo-run 2'))
})

test('launch without a worktree refuses', () => {
  const runDir = seed({ worktree: null })
  assert.equal(launch(runDir, 2, {}, fakeDeps()).refused, 'no-worktree')
})

test('dry run returns the command without running anything', () => {
  const runDir = seed()
  const deps = fakeDeps()
  const r = launch(runDir, 2, { dryRun: true }, deps)
  assert.equal(r.args[0], '--bg')
  assert.deepEqual(deps.calls, [])
})

test('confirmation needs a session that is new since the launch, under a free name', () => {
  // An unrecorded writer already holds the base name: the launch takes the next name, and the old
  // session is never mistaken for the new one.
  const runDir = seed()
  const writer = agent('phase-2-api', 'blocked', 'old00000')
  const r = launch(runDir, 2, { exclude: ['phase-2-api'] }, agentsDeps([writer], [writer]))
  assert.equal(r.name, 'phase-2-api-c1')
  assert.deepEqual([r.started, r.confirmed], [true, false])
  const ok = launch(runDir, 2, { exclude: ['phase-2-api'] }, agentsDeps([writer], [writer, agent('phase-2-api-c1', 'working', 'new11111')]))
  assert.deepEqual([ok.confirmed, ok.id], [true, 'new11111'])
})

test('a relative run dir is made absolute for --add-dir', () => {
  const runDir = seed()
  const rel = relative(process.cwd(), runDir)
  const r = launch(rel, 2, { dryRun: true }, fakeDeps())
  assert.equal(r.args[r.args.indexOf('--add-dir') + 1], runDir)
})

test('a relaunch excludes the sessions that handed over, and still refuses a newer one', () => {
  // The failed writer idles in agent view; a fresh session for the phase replaces it. A session
  // started after the handoff (a second /ph3-next) has not handed over, so it still blocks.
  const runDir = seed({ sessions: [s('phase-2-api')] })
  writeHandoff(runDir, 2, { phase: 2, status: 'failed', blocking_questions: 0, session: 'phase-2-api' })
  const writer = agent('phase-2-api', 'blocked', 'old00000')
  const ok = main([runDir, '2', '--exclude-handed-over'], agentsDeps([writer], [writer, agent('phase-2-api-c1', 'working', 'new11111')]))
  assert.deepEqual([ok.confirmed, ok.name], [true, 'phase-2-api-c1'])
  const newer = agent('phase-2-api-c1', 'working', 'new11111')
  const again = main([runDir, '2', '--exclude-handed-over'], agentsDeps([writer, newer], [writer, newer]))
  assert.deepEqual([again.refused, again.live], ['live-session', ['phase-2-api-c1']])
})
