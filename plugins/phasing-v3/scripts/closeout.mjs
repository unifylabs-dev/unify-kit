#!/usr/bin/env node
// closeout: end a run on purpose. Set its final status (complete, complete with unmet criteria,
// parked or abandoned), then archive it: stop its idle sessions, remove its worktrees that hold
// nothing to lose, and move the run folder under archive/<year>/. One past run was orphaned for
// months; a run that ends gets closed. A parked run stays in place and can resume.
//   status <run-dir> <status> [--reason <text>]
//   archive <run-dir>
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { readRun, writeRun } from './lib/run-state.mjs'
import { liveSessions, readAgents } from './reconcile.mjs'

export const FINAL_STATUS = ['complete', 'complete_unmet', 'parked', 'abandoned']
// Ignored folders that a build or install recreates. Any other ignored file (an env file, a local
// database) is lost with the worktree, so a worktree holding one is kept.
const REGENERABLE = ['node_modules/', '.next/', 'dist/', 'build/', 'out/', '.turbo/', 'coverage/', '.cache/', '.vercel/']
const REMOVE_TIMEOUT_MS = 300_000

export function setStatus(runDir, status, reason, now) {
  const run = readRun(runDir)
  if (status === 'in_progress') {
    if (run.status !== 'parked') throw new Error(`only a parked run can go back to in_progress (status is ${run.status})`)
    return writeRun(runDir, { ...run, status, reason: null }, now)
  }
  if (!FINAL_STATUS.includes(status)) throw new Error(`status must be one of ${FINAL_STATUS.join(', ')}, got ${status}`)
  const needsReason = status === 'parked' || status === 'abandoned'
  if (needsReason && (typeof reason !== 'string' || reason.trim() === '')) throw new Error(`a ${status} run needs a reason`)
  return writeRun(runDir, { ...run, status, reason: needsReason ? reason.trim() : (reason ?? null) }, now)
}

function ignoredAtRisk(worktree, deps) {
  const r = deps.exec('git', ['-C', worktree, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])
  if (r.code !== 0) return ['(ignored files could not be listed)']
  return r.stdout.split('\n').filter(Boolean)
    .filter(p => !REGENERABLE.some(d => p === d || p.startsWith(d) || p.includes(`/${d}`)))
}

export function archive(runDirArg, deps) {
  const runDir = resolve(runDirArg)
  const run = readRun(runDir)
  if (run.status === 'in_progress') throw new Error('the run is in_progress; set its final status first')
  if (run.status === 'parked') throw new Error('a parked run stays in place; set it to in_progress to resume, or abandon it first')
  // Beside the run folder, wherever the repo now lives: <root>/.claude/phasing/<run-id>.
  const root = dirname(dirname(dirname(runDir)))
  const target = join(dirname(runDir), 'archive', String(deps.now().getUTCFullYear()), run.run_id)
  // Checked before anything changes, so a refusal leaves the run as it was.
  if (existsSync(target)) throw new Error(`archive target exists: ${target}`)
  const withTrees = run.phases.filter(p => p.worktree !== null && existsSync(p.worktree))

  // A session still working would lose its worktree mid-task and write its handoff into a folder
  // that no longer exists. Idle sessions (finished writers, or ones waiting on an answer in a run
  // being closed) are stopped first.
  const stopped = []
  if (withTrees.length > 0) {
    const agents = readAgents(deps)
    if (agents === null) throw new Error('agent view is unavailable, so live sessions cannot be checked; retry, or stop the phase sessions first')
    const live = withTrees.flatMap(p => liveSessions(agents, p))
    const working = live.filter(a => a.state === 'working')
    if (working.length > 0) throw new Error(`sessions still working: ${working.map(a => a.name).join(', ')}; let them finish or stop them first`)
    for (const a of live) {
      const r = deps.exec('claude', ['stop', a.id])
      if (r.code !== 0) throw new Error(`could not stop session ${a.name}: ${r.stderr.trim()}`)
      stopped.push(a.name)
    }
  }

  const removed = []
  const skipped = []
  for (const phase of run.phases) {
    if (phase.worktree === null) continue
    if (!existsSync(phase.worktree)) {
      deps.exec('git', ['-C', root, 'worktree', 'prune'])
      continue
    }
    const lost = ignoredAtRisk(phase.worktree, deps)
    if (lost.length > 0) {
      skipped.push({ path: phase.worktree, reason: `ignored files would be deleted: ${lost.join(', ')}` })
      continue
    }
    // No --force: a worktree with uncommitted work stays, and the user decides what to do with it.
    const r = deps.exec('git', ['-C', root, 'worktree', 'remove', phase.worktree], { timeoutMs: REMOVE_TIMEOUT_MS })
    if (r.code === 0) removed.push(phase.worktree)
    else skipped.push({ path: phase.worktree, reason: r.stderr.trim().split('\n')[0] || `git exited ${r.code}` })
  }
  mkdirSync(dirname(target), { recursive: true })
  renameSync(runDir, target)
  return { archivedTo: target, removed, skipped, stopped }
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  const [cmd, runDir, status] = positional
  if (cmd === 'status' && runDir !== undefined && status !== undefined) {
    return setStatus(runDir, status, typeof flags.reason === 'string' ? flags.reason : null, deps.now())
  }
  if (cmd === 'archive' && runDir !== undefined) return archive(runDir, deps)
  throw new Error('usage: closeout.mjs status <run-dir> <status> [--reason <text>] | archive <run-dir>')
}

cli(import.meta.url, main)
