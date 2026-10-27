#!/usr/bin/env node
// continue: decide whether a paused phase continues on its own in a fresh session, and launch it.
// Called at the end of a phase session's turn (by the context-watch mod during the pilot), or by
// /ph3-next when the user asks. Unattended continuations stop after two in a row, after a session
// that made no progress, and while a blocking question to the user is open.
//   <run-dir> <n> [--had-input] [--human-launch]
import { cli, parseFlags } from './lib/deps.mjs'
import { phaseOf, readHandoff, readRun, writeRun } from './lib/run-state.mjs'
import { launch } from './launch.mjs'

export const CAP = 2

export function decide({ phase, handoff, commitsSinceStart, hadInput, humanLaunch }) {
  const stop = reason => ({ action: 'stop', reason, count: phase.auto_continuations })
  if (handoff?.status !== 'partial') return stop('not-partial')
  if (handoff.blocking_questions > 0) return stop('blocking-question-open')
  if (humanLaunch) return { action: 'launch', reason: 'ok', count: 0 }
  if (commitsSinceStart === 0) return stop('no-progress')
  const base = hadInput ? 0 : phase.auto_continuations
  if (base >= CAP) return stop('cap-reached')
  return { action: 'launch', reason: 'ok', count: base + 1 }
}

// Progress is read from git: commits in the phase worktree since the session started.
export function commitsSince(worktree, iso, deps) {
  const r = deps.exec('git', ['-C', worktree, 'rev-list', '--count', `--since=${iso}`, 'HEAD', '--', '.', ':!.claude/phasing'])
  return r.code === 0 ? Number(r.stdout.trim()) : 0
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  const [runDir, nArg] = positional
  const n = Number(nArg)
  if (runDir === undefined || !Number.isInteger(n)) throw new Error('usage: continue.mjs <run-dir> <n> [--had-input] [--human-launch]')
  const humanLaunch = flags['human-launch'] === true
  const run = readRun(runDir)
  const phase = phaseOf(run, n)
  const handoff = readHandoff(runDir, n)
  const last = phase.sessions.at(-1)
  const commitsSinceStart = last === undefined || phase.worktree === null ? 0 : commitsSince(phase.worktree, last.started_at, deps)
  const d = decide({ phase, handoff, commitsSinceStart, hadInput: flags['had-input'] === true, humanLaunch })
  const { manual } = launch(runDir, n, { dryRun: true }, deps)
  if (d.action === 'stop') return { action: 'stop', reason: d.reason, manual }

  const launched = launch(runDir, n, { continuation: !humanLaunch, excludeSession: handoff.session }, deps)
  if (launched.confirmed) {
    const fresh = readRun(runDir)
    phaseOf(fresh, n).auto_continuations = d.count
    writeRun(runDir, fresh, deps.now())
  }
  return { action: 'launch', reason: d.reason, launched, manual: launched.manual ?? manual }
}

cli(import.meta.url, main)
