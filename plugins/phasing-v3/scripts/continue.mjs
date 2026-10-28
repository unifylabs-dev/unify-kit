#!/usr/bin/env node
// continue: decide whether a paused phase continues on its own in a fresh session, and launch it.
// Called at the end of a phase session's turn (by the context-watch mod during the pilot), or by
// /ph3-next when the user asks. Unattended continuations stop after two in a row, after a session
// that made no progress, and while a blocking question to the user is open.
//   <run-dir> <n> [--had-input] [--human-launch]
import { cli, parseFlags } from './lib/deps.mjs'
import { phaseOf, readHandoff, readRun } from './lib/run-state.mjs'
import { handedOver, launch } from './launch.mjs'

export const CAP = 2

// commitsSinceStart is null when the writer of the handoff is not in run.json, so its start time
// (and with it the progress check) is unknown. A launch the user asked for skips the unattended
// guards: the cap, the progress check, and a question the user has just answered.
export function decide({ phase, handoff, commitsSinceStart, hadInput, humanLaunch }) {
  const stop = reason => ({ action: 'stop', reason, count: phase.auto_continuations })
  if (handoff?.status === 'invalid') return stop('handoff-unreadable')
  if (handoff?.status !== 'partial') return stop('not-partial')
  if (humanLaunch) return { action: 'launch', reason: 'ok', count: 0 }
  if (handoff.blocking_questions > 0) return stop('blocking-question-open')
  if (commitsSinceStart === null) return stop('writer-unrecorded')
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
  const writerAt = phase.sessions.findIndex(s => s.name === handoff?.session)
  const commitsSinceStart = writerAt === -1 || phase.worktree === null ? null : commitsSince(phase.worktree, phase.sessions[writerAt].started_at, deps)
  const d = decide({ phase, handoff, commitsSinceStart, hadInput: flags['had-input'] === true, humanLaunch })
  const { manual } = launch(runDir, n, { dryRun: true }, deps)
  if (d.action === 'stop') return { action: 'stop', reason: d.reason, manual }

  const launched = launch(runDir, n, { continuation: !humanLaunch, exclude: handedOver(phase, handoff), count: d.count }, deps)
  // Anything short of a confirmed handover is a stop, so the caller asks the user instead of going quiet.
  if (!launched.confirmed) {
    const reason = launched.refused !== undefined ? `launch-refused-${launched.refused}` : launched.error !== undefined ? 'launch-failed' : 'launch-unconfirmed'
    return { action: 'stop', reason, launched, manual: launched.manual ?? manual }
  }
  return { action: 'launch', reason: d.reason, launched, manual: launched.manual }
}

cli(import.meta.url, main)
