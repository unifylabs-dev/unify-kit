#!/usr/bin/env node
// reconcile: rebuild a run's state from what can be observed (git, GitHub, live background
// sessions, handoff files) instead of trusting what was last written. In past runs, run.json
// drifted from reality in four of six runs, so state is read, not reported.
//   <run-dir> [--write]  → { run, flags, next }
import { cli, parseFlags } from './lib/deps.mjs'
import { readHandoff, readRun, writeRun } from './lib/run-state.mjs'

const FAILED_CONCLUSIONS = ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']
const PASSED_CONCLUSIONS = ['SUCCESS', 'NEUTRAL', 'SKIPPED']
const LIVE_STATES = ['working', 'blocked']

// gh's statusCheckRollup mixes check runs (status + conclusion) and commit statuses (state).
export function ciFromRollup(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) return null
  const failed = c => FAILED_CONCLUSIONS.includes(c.conclusion) || c.state === 'FAILURE' || c.state === 'ERROR'
  const passed = c => PASSED_CONCLUSIONS.includes(c.conclusion) || c.state === 'SUCCESS'
  if (rollup.some(failed)) return 'fail'
  if (rollup.every(passed)) return 'pass'
  return 'pending'
}

// A phase's live background sessions: one of its own session names, in its own worktree (names
// repeat across runs and repos), and not finished.
export function liveSessions(agents, phase) {
  if (phase.worktree === null) return []
  const names = new Set(phase.sessions.map(s => s.name))
  return agents.filter(a => names.has(a.name) && a.cwd === phase.worktree && LIVE_STATES.includes(a.state))
}

function readAgents(deps) {
  const r = deps.exec('claude', ['agents', '--json'])
  if (r.code !== 0) return null
  try {
    const agents = JSON.parse(r.stdout)
    return Array.isArray(agents) ? agents : null
  } catch {
    return null
  }
}

// One gh call per phase branch. The first failure that is not "no PR" marks gh unavailable for
// the rest of the run of this command: no remote, no auth, or no gh at all.
function readPr(branch, repo, deps) {
  const r = deps.exec('gh', ['pr', 'view', branch, '--json', 'number,state,statusCheckRollup'], { cwd: repo })
  if (r.code === 0) {
    try {
      const pr = JSON.parse(r.stdout)
      return { number: pr.number, state: pr.state, ci: ciFromRollup(pr.statusCheckRollup ?? []) }
    } catch {
      return 'unknown'
    }
  }
  return /no pull requests found/i.test(r.stderr) ? null : 'unknown'
}

export function gatherFacts(run, runDir, deps) {
  const remotes = deps.exec('git', ['remote'], { cwd: run.repo })
  const remote = remotes.code === 0 && remotes.stdout.trim() !== ''
  const agents = readAgents(deps)
  let gh = 'ok'
  const phases = {}
  for (const phase of run.phases) {
    const live = agents === null ? [] : liveSessions(agents, phase).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
    let unpushed = null
    let pr = null
    if (phase.branch !== null && remote) {
      const count = deps.exec('git', ['rev-list', '--count', phase.branch, '--not', '--remotes'], { cwd: run.repo })
      // A branch missing locally is not "0 unpushed"; leave it unknown.
      unpushed = count.code === 0 ? Number(count.stdout.trim()) : null
      pr = gh === 'unavailable' ? 'unknown' : readPr(phase.branch, run.repo, deps)
      if (pr === 'unknown') gh = 'unavailable'
    }
    phases[phase.n] = {
      handoff: readHandoff(runDir, phase.n),
      // Unknown is not "no": a failed agents call must never make a running phase look dead.
      live: agents === null ? 'unknown' : live.length > 0 ? 'yes' : 'no',
      liveName: live[0]?.name ?? null,
      liveState: live[0]?.state ?? null,
      unpushed,
      pr,
    }
  }
  return { gh, agents: agents === null ? 'unavailable' : 'ok', remote, phases }
}

export function derivePhase(phase, f) {
  const h = f.handoff
  if (h?.status === 'invalid') return { status: phase.status, flags: ['handoff-unreadable'] }
  // A finished session idles as `blocked` in agent view, so a final handoff outranks liveness.
  if (h?.status === 'complete' || h?.status === 'failed') return { status: h.status, flags: [] }
  if (h?.status === 'partial') {
    return { status: f.live === 'yes' && f.liveName !== h.session ? 'running' : 'partial', flags: [] }
  }
  if (f.live === 'yes') return { status: 'running', flags: [] }
  if (f.live === 'unknown') return { status: phase.status, flags: ['agents-unavailable'] }
  if (phase.sessions.length === 0) return { status: 'pending', flags: [] }
  return { status: 'failed', flags: ['session-ended-without-handoff'] }
}

const DETAIL = {
  'handoff-unreadable': (p, f) => `phase ${p.n}: handoff frontmatter is unreadable (${f.handoff.error})`,
  'agents-unavailable': p => `phase ${p.n}: claude agents --json failed, so live sessions are unknown`,
  'session-ended-without-handoff': p => `phase ${p.n}: session ${p.sessions.at(-1)?.name} is gone and wrote no handoff`,
}

export function reconcile(run, facts) {
  const next = structuredClone(run)
  const flags = []
  for (const phase of next.phases) {
    const f = facts.phases[phase.n]
    const { status, flags: codes } = derivePhase(phase, f)
    for (const code of codes) flags.push({ n: phase.n, code, detail: DETAIL[code](phase, f) })
    if (status !== phase.status) flags.push({ n: phase.n, code: 'status-changed', detail: `${phase.status}→${status}` })
    phase.status = status
    // Verification applies to a complete phase; anything else has to earn it again.
    if (status !== 'complete') phase.verified = false
    if (f.pr !== 'unknown') {
      phase.pr = f.pr?.number ?? null
      phase.pr_state = f.pr?.state ?? null
      phase.ci = f.pr?.ci ?? null
    }
    if (f.pr?.state === 'MERGED' && (status === 'pending' || status === 'running')) {
      flags.push({ n: phase.n, code: 'merged-outside-run', detail: `phase ${phase.n}: PR #${f.pr.number} is merged but the phase is ${status}` })
    }
    if (status === 'complete') {
      if (f.unpushed > 0) flags.push({ n: phase.n, code: 'unpushed-commits', detail: `${f.unpushed} commits on ${phase.branch} are not pushed` })
      if (f.pr === null) flags.push({ n: phase.n, code: 'complete-without-pr', detail: `phase ${phase.n} is complete but has no PR` })
      if (f.pr?.ci === 'fail') flags.push({ n: phase.n, code: 'ci-failing', detail: `phase ${phase.n}: CI fails on PR #${f.pr.number}` })
    }
  }
  if (facts.gh === 'unavailable') flags.push({ n: null, code: 'gh-unavailable', detail: 'gh failed, so PR and CI state are unknown' })
  return { run: next, flags }
}

// What /ph3-next does now. Phases run in order; a finished phase is verified before the next starts.
export function nextAction(run) {
  const running = run.phases.find(p => p.status === 'running')
  if (running !== undefined) return { kind: 'wait', n: running.n }
  const p = run.phases.find(x => !(x.status === 'complete' && x.verified))
  if (p === undefined) return { kind: 'closeout', n: null }
  const kind = { complete: 'verify', partial: 'continue', failed: 'relaunch', pending: 'launch' }[p.status]
  return { kind, n: p.n }
}

export function main(argv, deps) {
  const { positional, flags: opts } = parseFlags(argv)
  const [runDir] = positional
  if (runDir === undefined) throw new Error('usage: reconcile.mjs <run-dir> [--write]')
  const before = readRun(runDir)
  const { run, flags } = reconcile(before, gatherFacts(before, runDir, deps))
  const saved = opts.write === true ? writeRun(runDir, run, deps.now()) : run
  return { run: saved, flags, next: nextAction(saved) }
}

cli(import.meta.url, main)
