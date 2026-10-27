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

// gh's statusCheckRollup mixes check runs (name, status, conclusion) and commit statuses (context,
// state). A re-run check appears once per run, so only the latest run of each check counts, and a
// check GitHub marked STALE has been superseded.
export function ciFromRollup(rollup) {
  if (!Array.isArray(rollup)) return null
  const latest = new Map()
  for (const c of rollup) {
    if (c.conclusion === 'STALE') continue
    const key = c.name ?? c.context ?? JSON.stringify(c)
    const at = c.completedAt ?? c.startedAt ?? ''
    const prev = latest.get(key)
    if (prev === undefined || at >= (prev.completedAt ?? prev.startedAt ?? '')) latest.set(key, c)
  }
  const checks = [...latest.values()]
  if (checks.length === 0) return null
  const failed = c => FAILED_CONCLUSIONS.includes(c.conclusion) || c.state === 'FAILURE' || c.state === 'ERROR'
  const passed = c => PASSED_CONCLUSIONS.includes(c.conclusion) || c.state === 'SUCCESS'
  if (checks.some(failed)) return 'fail'
  if (checks.every(passed)) return 'pass'
  return 'pending'
}

// A phase's live sessions: background sessions working in the phase's own worktree, newest first.
// The worktree path is unique to the run and phase, so a session counts even when it was never
// recorded (an unconfirmed launch, or the printed command run by hand). Interactive sessions are
// the user looking around, not the phase's work.
export function liveSessions(agents, phase) {
  if (phase.worktree === null) return []
  return agents
    .filter(a => a.cwd === phase.worktree && LIVE_STATES.includes(a.state) && (a.kind ?? 'background') === 'background')
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
}

export function readAgents(deps) {
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
// the rest of this command: no auth, or no gh at all.
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
    const live = agents === null ? [] : liveSessions(agents, phase)
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
      liveId: live[0]?.id ?? null,
      liveAgents: live,
      unpushed,
      pr,
    }
  }
  return { gh, agents: agents === null ? 'unavailable' : 'ok', remote, phases }
}

// The newest live session decides: a session other than the handoff's writer is newer work (a
// continuation or a relaunch). A finished writer idles as `blocked`, so its own handoff stands.
// A live session that is `blocked` with no newer handoff is waiting for the user.
export function derivePhase(phase, f) {
  const h = f.handoff
  const waiting = f.liveState === 'blocked' ? ['session-waiting-for-input'] : []
  if (h?.status === 'invalid') return { status: phase.status, flags: ['handoff-unreadable'] }
  if (h !== null && f.live === 'yes' && f.liveName !== h.session) return { status: 'running', flags: waiting }
  if (h?.status === 'complete' || h?.status === 'failed') return { status: h.status, flags: [] }
  if (h?.status === 'partial') {
    return f.live === 'unknown' ? { status: phase.status, flags: ['agents-unavailable'] } : { status: 'partial', flags: [] }
  }
  if (f.live === 'yes') return { status: 'running', flags: waiting }
  if (phase.sessions.length === 0) return { status: 'pending', flags: [] }
  if (f.live === 'unknown') return { status: phase.status, flags: ['agents-unavailable'] }
  return { status: 'failed', flags: ['session-ended-without-handoff'] }
}

const DETAIL = {
  'handoff-unreadable': (p, f) => `phase ${p.n}: handoff frontmatter is unreadable (${f.handoff.error})`,
  'agents-unavailable': p => `phase ${p.n}: claude agents --json failed, so live sessions are unknown`,
  'session-ended-without-handoff': p => `phase ${p.n}: session ${p.sessions.at(-1)?.name} is gone and wrote no handoff`,
  'session-waiting-for-input': (p, f) =>
    `phase ${p.n}: session ${f.liveName} is waiting for input; answer it in agent view, or stop it (claude stop ${f.liveId}) to relaunch`,
}

const isoFromMs = ms => new Date(typeof ms === 'number' ? ms : 0).toISOString()

export function reconcile(run, facts) {
  const next = structuredClone(run)
  const flags = []
  for (const phase of next.phases) {
    const f = facts.phases[phase.n]
    // Record live sessions nobody recorded, so names keep counting up and the progress check has a start time.
    for (const a of f.liveAgents ?? []) {
      if (phase.sessions.some(s => s.name === a.name)) continue
      phase.sessions.push({ name: a.name, id: a.id ?? null, started_at: isoFromMs(a.startedAt), auto: false })
      flags.push({ n: phase.n, code: 'session-adopted', detail: `phase ${phase.n}: live session ${a.name} was not in run.json` })
    }
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
  if (facts.remote === false) flags.push({ n: null, code: 'no-remote', detail: 'the repo has no git remote, so there are no PRs or CI' })
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
