#!/usr/bin/env node
// closeout: end a run on purpose. Set its final status (complete, complete with unmet criteria,
// parked or abandoned), then archive it: remove its clean worktrees and move the run folder under
// archive/<year>/. One past run was orphaned for months; a run that ends gets closed.
//   status <run-dir> <status> [--reason <text>]
//   archive <run-dir>
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { readRun, writeRun } from './lib/run-state.mjs'

export const FINAL_STATUS = ['complete', 'complete_unmet', 'parked', 'abandoned']

export function setStatus(runDir, status, reason, now) {
  if (!FINAL_STATUS.includes(status)) throw new Error(`status must be one of ${FINAL_STATUS.join(', ')}, got ${status}`)
  const needsReason = status === 'parked' || status === 'abandoned'
  if (needsReason && (typeof reason !== 'string' || reason.trim() === '')) throw new Error(`a ${status} run needs a reason`)
  const run = readRun(runDir)
  return writeRun(runDir, { ...run, status, reason: needsReason ? reason.trim() : (reason ?? null) }, now)
}

export function archive(runDir, deps) {
  const run = readRun(runDir)
  if (run.status === 'in_progress') throw new Error('the run is in_progress; set its final status first')
  const target = join(run.repo, '.claude', 'phasing', 'archive', String(deps.now().getUTCFullYear()), run.run_id)
  // Checked before anything changes, so a refusal leaves the run as it was.
  if (existsSync(target)) throw new Error(`archive target exists: ${target}`)
  const removed = []
  const skipped = []
  for (const phase of run.phases) {
    if (phase.worktree === null) continue
    if (!existsSync(phase.worktree)) {
      deps.exec('git', ['worktree', 'prune'], { cwd: run.repo })
      continue
    }
    // No --force: a worktree with uncommitted work stays, and the user decides what to do with it.
    const r = deps.exec('git', ['-C', run.repo, 'worktree', 'remove', phase.worktree])
    if (r.code === 0) removed.push(phase.worktree)
    else skipped.push({ path: phase.worktree, reason: r.stderr.trim().split('\n')[0] || `git exited ${r.code}` })
  }
  mkdirSync(dirname(target), { recursive: true })
  renameSync(runDir, target)
  return { archivedTo: target, removed, skipped }
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
