import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readRun } from '../scripts/lib/run-state.mjs'
import { ciFromRollup, derivePhase, gatherFacts, liveSessions, nextAction, readAgents, reconcile } from '../scripts/reconcile.mjs'
import { NOW, fakeDeps, seedRun, tmpDir } from './helpers.mjs'

const s = name => ({ name, id: null, started_at: NOW.toISOString(), auto: false })
const ph = overrides => ({ n: 1, slug: 'setup', type: 'setup', status: 'pending', verified: false, branch: null,
  worktree: '/wt/p1', pr: null, pr_state: null, ci: null, sessions: [], auto_continuations: 0, ...overrides })
const pf = overrides => ({ handoff: null, live: 'no', liveName: null, liveState: null, unpushed: null, pr: null, ...overrides })
const h = (status, session = 'phase-1-setup') => ({ phase: 1, status, blocking_questions: 0, session })
// 'complete:v' is a complete, verified phase.
const run = specs => ({ schema: 'phasing-v3/1', run_id: 'demo-run', repo: '/r', base_branch: 'main', status: 'in_progress', reason: null,
  phases: specs.map((spec, i) => {
    const [status, v] = spec.split(':')
    return ph({ n: i + 1, slug: `p${i + 1}`, status, verified: v === 'v', sessions: status === 'pending' ? [] : [s(`phase-${i + 1}-p${i + 1}`)] })
  }), created_at: NOW.toISOString(), updated_at: NOW.toISOString() })

function runWithBranch() {
  const runDir = seedRun(tmpDir())
  const r = readRun(runDir)
  r.phases[0] = { ...r.phases[0], branch: 'phase/demo-run/p1-setup', worktree: '/wt/p1', status: 'running', sessions: [s('phase-1-setup')] }
  return { runDir, r }
}

test('ciFromRollup', () => {
  assert.equal(ciFromRollup([]), null)
  assert.equal(ciFromRollup([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { state: 'SUCCESS' }]), 'pass')
  assert.equal(ciFromRollup([{ status: 'COMPLETED', conclusion: 'FAILURE' }]), 'fail')
  assert.equal(ciFromRollup([{ state: 'ERROR' }]), 'fail')
  assert.equal(ciFromRollup([{ status: 'IN_PROGRESS', conclusion: '' }]), 'pending')
})

test('handoff complete wins over an idle live session', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running' }), pf({ handoff: h('complete'), live: 'yes', liveName: 'phase-1-setup' })),
    { status: 'complete', flags: [] })
})

test('partial handoff plus a different live session is a running continuation', () => {
  assert.equal(derivePhase(ph({}), pf({ handoff: h('partial', 'phase-1-setup'), live: 'yes', liveName: 'phase-1-setup-c1' })).status, 'running')
  assert.equal(derivePhase(ph({}), pf({ handoff: h('partial', 'phase-1-setup'), live: 'yes', liveName: 'phase-1-setup' })).status, 'partial')
})

test('session gone without a handoff is failed and flagged', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running', sessions: [s('phase-1-setup')] }), pf({ live: 'no' })),
    { status: 'failed', flags: ['session-ended-without-handoff'] })
})

test('agents unavailable keeps the status', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running', sessions: [s('phase-1-setup')] }), pf({ live: 'unknown' })),
    { status: 'running', flags: ['agents-unavailable'] })
})

test('unreadable handoff keeps the status', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running' }), pf({ handoff: { status: 'invalid', error: 'x' } })),
    { status: 'running', flags: ['handoff-unreadable'] })
})

test('gatherFacts survives a missing gh', () => {
  const { runDir, r } = runWithBranch()
  const deps = fakeDeps({ rules: [[/^git remote/, { stdout: 'origin\n' }], [/^git rev-list/, { stdout: '0\n' }],
    [/^gh /, { code: 127, stderr: 'not found: gh' }], [/^claude agents/, { stdout: '[]' }]] })
  const facts = gatherFacts(r, runDir, deps)
  assert.equal(facts.gh, 'unavailable')
  assert.equal(facts.phases[1].pr, 'unknown')
  assert.equal(reconcile(r, facts).flags.filter(f => f.code === 'gh-unavailable').length, 1)
})

test('no PR for the branch is null, not unknown', () => {
  const { runDir, r } = runWithBranch()
  const deps = fakeDeps({ rules: [[/^git remote/, { stdout: 'origin\n' }], [/^git rev-list/, { stdout: '2\n' }],
    [/^gh pr view/, { code: 1, stderr: 'no pull requests found for branch "phase/demo-run/p1-setup"' }], [/^claude agents/, { stdout: '[]' }]] })
  const facts = gatherFacts(r, runDir, deps)
  assert.equal(facts.gh, 'ok')
  assert.equal(facts.phases[1].pr, null)
  assert.equal(facts.phases[1].unpushed, 2)
})

test('live sessions match on name and worktree cwd', () => {
  const { runDir, r } = runWithBranch()
  r.phases[0].branch = null
  const elsewhere = [{ id: 'a1', name: 'phase-1-setup', cwd: '/other', state: 'working', startedAt: 1 }]
  const deps = fakeDeps({ rules: [[/^git remote/, { stdout: '' }], [/^claude agents/, { stdout: JSON.stringify(elsewhere) }]] })
  assert.equal(gatherFacts(r, runDir, deps).phases[1].live, 'no')
  assert.deepEqual(liveSessions([...elsewhere, { name: 'phase-1-setup', cwd: '/wt/p1', state: 'blocked', startedAt: 2 }], r.phases[0]).map(a => a.cwd), ['/wt/p1'])
})

test('reconcile flags drift and stranded work', () => {
  const r = run(['running', 'pending', 'complete'])
  r.phases[0].branch = 'phase/demo-run/p1-p1'
  const facts = { gh: 'ok', agents: 'ok', remote: true, phases: {
    1: pf({ handoff: h('complete', 'phase-1-p1'), unpushed: 3, pr: null }),
    2: pf({ pr: { number: 7, state: 'MERGED', ci: 'pass' } }),
    3: pf({ handoff: { ...h('complete', 'phase-3-p3'), phase: 3 }, unpushed: 0, pr: { number: 9, state: 'OPEN', ci: 'fail' } }),
  } }
  const { run: after, flags } = reconcile(r, facts)
  const has = (n, code) => flags.some(f => f.n === n && f.code === code)
  assert.ok(has(1, 'status-changed') && flags.find(f => f.code === 'status-changed').detail === 'running→complete')
  assert.ok(has(1, 'unpushed-commits') && has(1, 'complete-without-pr') && has(2, 'merged-outside-run') && has(3, 'ci-failing'))
  assert.deepEqual([after.phases[2].pr, after.phases[2].pr_state, after.phases[2].ci], [9, 'OPEN', 'fail'])
  assert.equal(r.phases[0].status, 'running', 'reconcile does not mutate its input')
})

test('nextAction covers every kind', () => {
  assert.deepEqual(nextAction(run(['complete:v', 'running'])), { kind: 'wait', n: 2 })
  assert.deepEqual(nextAction(run(['complete'])), { kind: 'verify', n: 1 })
  assert.deepEqual(nextAction(run(['complete:v', 'partial'])), { kind: 'continue', n: 2 })
  assert.deepEqual(nextAction(run(['failed'])), { kind: 'relaunch', n: 1 })
  assert.deepEqual(nextAction(run(['complete:v', 'pending'])), { kind: 'launch', n: 2 })
  assert.deepEqual(nextAction(run(['complete:v', 'complete:v'])), { kind: 'closeout', n: null })
})

test('partial handoff with agents unavailable keeps the status', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running', sessions: [s('phase-1-setup'), s('phase-1-setup-c1')] }),
    pf({ handoff: h('partial', 'phase-1-setup'), live: 'unknown' })), { status: 'running', flags: ['agents-unavailable'] })
})

test('a background session in the worktree is live even if never recorded; interactive ones are not', () => {
  const p = ph({ worktree: '/wt/p1', sessions: [] })
  assert.equal(liveSessions([{ name: 'phase-1-setup', cwd: '/wt/p1', state: 'working', kind: 'background', startedAt: 5 }], p).length, 1)
  assert.equal(liveSessions([{ name: 'look-around', cwd: '/wt/p1', state: 'working', kind: 'interactive', startedAt: 5 }], p).length, 0)
})

test('reconcile adopts an unrecorded live session', () => {
  const r = run(['pending'])
  const agent = { name: 'phase-1-p1', id: 'abc12345', state: 'working', startedAt: Date.parse('2026-11-01T09:00:00Z') }
  const facts = { gh: 'ok', agents: 'ok', remote: true, phases: { 1: pf({ live: 'yes', liveName: agent.name, liveState: 'working', liveId: agent.id, liveAgents: [agent] }) } }
  const { run: after, flags } = reconcile(r, facts)
  assert.deepEqual(after.phases[0].sessions, [{ name: 'phase-1-p1', id: 'abc12345', started_at: '2026-11-01T09:00:00.000Z', auto: false }])
  assert.equal(after.phases[0].status, 'running')
  assert.ok(flags.some(f => f.code === 'session-adopted'))
})

test('a blocked session with no handoff is running and flagged as waiting for input', () => {
  assert.deepEqual(derivePhase(ph({ status: 'running', sessions: [s('phase-1-setup')] }), pf({ live: 'yes', liveName: 'phase-1-setup', liveState: 'blocked' })),
    { status: 'running', flags: ['session-waiting-for-input'] })
})

test('a newer live session outranks an older final handoff', () => {
  assert.equal(derivePhase(ph({ sessions: [s('phase-1-setup'), s('phase-1-setup-c1')] }),
    pf({ handoff: h('failed', 'phase-1-setup'), live: 'yes', liveName: 'phase-1-setup-c1', liveState: 'working' })).status, 'running')
})

test('ciFromRollup keeps the latest run of each check and ignores stale ones', () => {
  assert.equal(ciFromRollup([
    { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: '2026-11-01T09:00:00Z' },
    { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-11-01T09:10:00Z' },
  ]), 'pass')
  assert.equal(ciFromRollup([{ name: 'lint', status: 'COMPLETED', conclusion: 'STALE' }, { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }]), 'pass')
})

test('agents unavailable does not flag phases that never started', () => {
  assert.deepEqual(derivePhase(ph({ sessions: [] }), pf({ live: 'unknown' })), { status: 'pending', flags: [] })
})

test('no remote is one flag, and PRs read as none', () => {
  const { runDir, r } = runWithBranch()
  const facts = gatherFacts(r, runDir, fakeDeps({ rules: [[/^git remote/, { stdout: '' }], [/^claude agents/, { stdout: '[]' }]] }))
  assert.equal(facts.remote, false)
  const { flags } = reconcile(r, facts)
  assert.equal(flags.filter(f => f.code === 'no-remote' && f.n === null).length, 1)
  assert.equal(flags.some(f => f.code === 'gh-unavailable'), false)
})

// Final review: facts that drift, and sessions newer than the handoff's writer.
test('a session newer than the handoff writer keeps its status while agents are unknown, and fails when it is gone', () => {
  // A fix or relaunch session (c1) started after the writer's handoff; the old handoff does not speak for it.
  const phase = ph({ status: 'running', sessions: [s('phase-1-setup'), s('phase-1-setup-c1')] })
  for (const old of ['complete', 'failed', 'partial']) {
    assert.deepEqual(derivePhase(phase, pf({ handoff: h(old), live: 'unknown' })), { status: 'running', flags: ['agents-unavailable'] }, old)
    assert.deepEqual(derivePhase(phase, pf({ handoff: h(old), live: 'no' })), { status: 'failed', flags: ['session-ended-without-handoff'] }, old)
    // Only the old writer still idles in agent view.
    assert.deepEqual(derivePhase(phase, pf({ handoff: h(old), live: 'yes', liveName: 'phase-1-setup', liveState: 'blocked' })),
      { status: 'failed', flags: ['session-ended-without-handoff'] }, old)
  }
})

test('agent view in an unknown shape is unavailable, not "no live session"', () => {
  const read = out => readAgents(fakeDeps({ rules: [[/^claude agents/, { stdout: JSON.stringify(out) }]] }))
  const bg = { id: 'a1', cwd: '/wt/p1', kind: 'background', name: 'phase-1-setup', state: 'working', startedAt: 1 }
  assert.equal(read([bg, { id: 'i1', cwd: '/x', kind: 'interactive', name: 'x', status: 'idle' }]).length, 2)
  assert.equal(read({ agents: [bg] }), null)
  assert.equal(read([{ ...bg, state: undefined, status: 'working' }]), null)
  assert.equal(read([{ ...bg, state: 'thinking' }]), null)
  assert.equal(read([{ ...bg, cwd: undefined }]), null)
})

test('when gh fails, a recorded PR keeps its number but its CI reads unknown', () => {
  const { runDir, r } = runWithBranch()
  r.phases[0] = { ...r.phases[0], pr: 7, pr_state: 'OPEN', ci: 'pass' }
  const deps = fakeDeps({ rules: [[/^git remote/, { stdout: 'origin\n' }], [/^git rev-list/, { stdout: '0\n' }],
    [/^gh /, { code: 4, stderr: 'authentication required' }], [/^claude agents/, { stdout: '[]' }]] })
  const p = reconcile(r, gatherFacts(r, runDir, deps)).run.phases[0]
  assert.deepEqual([p.pr, p.pr_state, p.ci], [7, 'OPEN', 'unknown'])
})

test('reconcile records the branch each PR targets', () => {
  const { runDir, r } = runWithBranch()
  const deps = fakeDeps({ rules: [[/^git remote/, { stdout: 'origin\n' }], [/^git rev-list/, { stdout: '0\n' }],
    [/^gh pr view .*baseRefName/, { stdout: '{"number":7,"state":"MERGED","baseRefName":"phase/demo-run/p0-x","statusCheckRollup":[]}' }],
    [/^claude agents/, { stdout: '[]' }]] })
  const p = reconcile(r, gatherFacts(r, runDir, deps)).run.phases[0]
  assert.deepEqual([p.pr, p.pr_state, p.pr_base], [7, 'MERGED', 'phase/demo-run/p0-x'])
})

test('a run that is not in progress has nothing next', () => {
  for (const status of ['parked', 'abandoned', 'complete']) assert.deepEqual(nextAction({ ...run(['pending']), status }), { kind: 'inactive', n: null }, status)
})
