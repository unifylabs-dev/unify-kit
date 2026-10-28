#!/usr/bin/env node
// launch: start a phase as a background session in its worktree, confirm it appears in agent
// view, and record it. The command is always returned for manual use too, as the fallback.
//   <run-dir> <n> [--continuation] [--dry-run] [--force] [--exclude <name,name>] [--exclude-handed-over]
import { resolve } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { phaseOf, readHandoff, readRun, writeRun } from './lib/run-state.mjs'
import { liveSessions, readAgents } from './reconcile.mjs'

// The handoff's writer and every session before it have handed over. They idle in agent view and
// do not block the session that replaces them. A session started after the handoff has not handed
// over, so a second launch racing this one is still refused.
export function handedOver(phase, handoff) {
  if (typeof handoff?.session !== 'string') return []
  const at = phase.sessions.findIndex(s => s.name === handoff.session)
  return at === -1 ? [handoff.session] : phase.sessions.slice(0, at + 1).map(s => s.name)
}

const POLLS = 5
const POLL_MS = 2000
// Background isolation off: the phase already has its own worktree, and a continuation must land
// in the same one. Executors run at xhigh effort: long agentic work.
const SETTINGS = '{"worktree":{"bgIsolation":"none"}}'

// The next name in the phase's chain, skipping names already in agent view for this worktree
// (an unrecorded session may hold one), so a new session is never confused with an old one.
export function sessionName(phase, taken = []) {
  const base = `phase-${phase.n}-${phase.slug}`
  let k = phase.sessions.length
  const at = i => (i === 0 ? base : `${base}-c${i}`)
  while (taken.includes(at(k))) k++
  return at(k)
}

export const launchArgs = (run, phase, runDir, name) =>
  ['--bg', '--name', name, '--effort', 'xhigh', '--add-dir', runDir, '--settings', SETTINGS, `/ph3-execute ${run.run_id} ${phase.n}`]

const quote = s => `'${String(s).replace(/'/g, `'\\''`)}'`
const shellWord = s => (/^[A-Za-z0-9_\/.:=@%+-]+$/.test(s) ? s : quote(s))

export const manualCommand = (phase, args) => `cd ${quote(phase.worktree)} && claude ${args.map(shellWord).join(' ')}`

// `exclude` names sessions that have handed over (they idle as `blocked`). `count`, when given, is
// saved as the phase's auto-continuation count whenever `claude --bg` ran, confirmed or not, so the
// cap holds even when agent view is slow to list the new session.
export function launch(runDirArg, n, { continuation = false, dryRun = false, force = false, exclude = [], count = null } = {}, deps) {
  // Absolute: --add-dir is resolved against the session's cwd, which is the worktree.
  const runDir = resolve(runDirArg)
  const run = readRun(runDir)
  const phase = phaseOf(run, Number(n))
  const plan = name => {
    const args = launchArgs(run, phase, runDir, name)
    return { name, args, manual: manualCommand(phase, args) }
  }
  if (phase.worktree === null) return { name: sessionName(phase), started: false, confirmed: false, id: null, manual: null, refused: 'no-worktree' }
  if (dryRun) return { ...plan(sessionName(phase)), started: false, confirmed: false, id: null }

  // Without agent view the launch can be neither guarded nor confirmed, so hand the command to the user.
  const before = readAgents(deps)
  if (before === null) return { ...plan(sessionName(phase)), started: false, confirmed: false, id: null, refused: 'agents-unavailable' }
  const { name, args, manual } = plan(sessionName(phase, before.filter(a => a.cwd === phase.worktree).map(a => a.name)))
  const others = liveSessions(before, phase).filter(a => !exclude.includes(a.name))
  if (others.length > 0 && !force) {
    return { name, started: false, confirmed: false, id: null, manual, refused: 'live-session', live: others.map(a => a.name) }
  }

  const result = deps.exec('claude', args, { cwd: phase.worktree, timeoutMs: 60_000 })
  if (result.code !== 0) return { name, started: false, confirmed: false, id: null, manual, error: result.stderr.trim() }

  // Only a session that was not there before the launch confirms it.
  const seen = new Set(before.map(a => a.id))
  let match
  for (let i = 0; i < POLLS && match === undefined; i++) {
    if (i > 0) deps.sleep(POLL_MS)
    match = (readAgents(deps) ?? []).find(a =>
      a.name === name && a.cwd === phase.worktree && !seen.has(a.id) && !['failed', 'stopped'].includes(a.state))
  }
  if (match !== undefined || count !== null) {
    // Read again before writing: the run may have changed while the session started.
    const fresh = readRun(runDir)
    const target = phaseOf(fresh, Number(n))
    if (match !== undefined) {
      target.sessions.push({ name, id: match.id ?? null, started_at: deps.now().toISOString(), auto: continuation })
      target.status = 'running'
    }
    if (count !== null) target.auto_continuations = count
    writeRun(runDir, fresh, deps.now())
  }
  // started without confirmed: a session may be starting. Check agent view before using the manual line.
  return { name, started: true, confirmed: match !== undefined, id: match?.id ?? null, manual }
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  const [runDir, n] = positional
  if (runDir === undefined || n === undefined) throw new Error('usage: launch.mjs <run-dir> <n> [--continuation] [--dry-run] [--force] [--exclude <name>] [--exclude-handed-over]')
  const exclude = typeof flags.exclude === 'string' ? flags.exclude.split(',').filter(Boolean) : []
  // A relaunch, or a fix after verify, replaces the sessions that wrote the phase's handoff.
  if (flags['exclude-handed-over'] === true) exclude.push(...handedOver(phaseOf(readRun(runDir), Number(n)), readHandoff(runDir, Number(n))))
  return launch(runDir, Number(n), {
    continuation: flags.continuation === true,
    dryRun: flags['dry-run'] === true,
    force: flags.force === true,
    exclude,
  }, deps)
}

cli(import.meta.url, main)
