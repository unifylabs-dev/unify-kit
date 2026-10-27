#!/usr/bin/env node
// launch: start a phase as a background session in its worktree, confirm it appears in agent
// view, and record it. The command is always returned for manual use too, as the fallback.
//   <run-dir> <n> [--continuation] [--dry-run] [--force] [--exclude <name,name>]
import { cli, parseFlags } from './lib/deps.mjs'
import { phaseOf, readRun, writeRun } from './lib/run-state.mjs'
import { liveSessions, readAgents } from './reconcile.mjs'

const POLLS = 5
const POLL_MS = 2000
// Background isolation off: the phase already has its own worktree, and a continuation must land
// in the same one. Executors run at xhigh effort: long agentic work.
const SETTINGS = '{"worktree":{"bgIsolation":"none"}}'

export const sessionName = phase =>
  phase.sessions.length === 0 ? `phase-${phase.n}-${phase.slug}` : `phase-${phase.n}-${phase.slug}-c${phase.sessions.length}`

export const launchArgs = (run, phase, runDir, name) =>
  ['--bg', '--name', name, '--effort', 'xhigh', '--add-dir', runDir, '--settings', SETTINGS, `/ph3-execute ${run.run_id} ${phase.n}`]

const quote = s => `'${String(s).replace(/'/g, `'\\''`)}'`
const shellWord = s => (/^[A-Za-z0-9_\/.:=@%+-]+$/.test(s) ? s : quote(s))

export const manualCommand = (phase, args) => `cd ${quote(phase.worktree)} && claude ${args.map(shellWord).join(' ')}`

// `exclude` names sessions that have handed over (they idle as `blocked`). `count`, when given, is
// saved as the phase's auto-continuation count whenever `claude --bg` ran, confirmed or not, so the
// cap holds even when agent view is slow to list the new session.
export function launch(runDir, n, { continuation = false, dryRun = false, force = false, exclude = [], count = null } = {}, deps) {
  const run = readRun(runDir)
  const phase = phaseOf(run, Number(n))
  const name = sessionName(phase)
  if (phase.worktree === null) return { name, confirmed: false, id: null, manual: null, refused: 'no-worktree' }
  const args = launchArgs(run, phase, runDir, name)
  const manual = manualCommand(phase, args)
  if (dryRun) return { name, args, confirmed: false, id: null, manual }

  // Without agent view the launch can be neither guarded nor confirmed, so hand the command to the user.
  const before = readAgents(deps)
  if (before === null) return { name, confirmed: false, id: null, manual, refused: 'agents-unavailable' }
  const others = liveSessions(before, phase).filter(a => !exclude.includes(a.name))
  if (others.length > 0 && !force) return { name, confirmed: false, id: null, manual, refused: 'live-session', live: others.map(a => a.name) }

  const started = deps.exec('claude', args, { cwd: phase.worktree, timeoutMs: 60_000 })
  if (started.code !== 0) return { name, confirmed: false, id: null, manual, error: started.stderr.trim() }

  let match
  for (let i = 0; i < POLLS && match === undefined; i++) {
    if (i > 0) deps.sleep(POLL_MS)
    match = (readAgents(deps) ?? []).find(a => a.name === name && a.cwd === phase.worktree && !['failed', 'stopped'].includes(a.state))
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
  return { name, confirmed: match !== undefined, id: match?.id ?? null, manual }
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  const [runDir, n] = positional
  if (runDir === undefined || n === undefined) throw new Error('usage: launch.mjs <run-dir> <n> [--continuation] [--dry-run] [--force] [--exclude <name>]')
  return launch(runDir, Number(n), {
    continuation: flags.continuation === true,
    dryRun: flags['dry-run'] === true,
    force: flags.force === true,
    exclude: typeof flags.exclude === 'string' ? flags.exclude.split(',').filter(Boolean) : [],
  }, deps)
}

cli(import.meta.url, main)
