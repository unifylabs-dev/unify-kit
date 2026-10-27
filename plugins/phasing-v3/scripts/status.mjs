#!/usr/bin/env node
// status: where a run stands, read from the same facts reconcile uses. It never writes, so it is
// safe from any terminal at any time.
//   [run-id] [--repo <path>]  → { text }
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { RUN_SCHEMA, mainRoot, readRun } from './lib/run-state.mjs'
import { gatherFacts, nextAction, reconcile } from './reconcile.mjs'

export const STALE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function waitingOn(phase, flagCodes = []) {
  if (phase.status === 'running') return flagCodes.includes('session-waiting-for-input') ? 'user: answer in agent view' : 'Claude'
  if (phase.status === 'partial') return 'continuation'
  if (phase.status === 'complete' && !phase.verified) return 'user: /ph3-next'
  if (phase.status === 'failed') return 'user: decide'
  return '—'
}

export function listRuns(repo) {
  const root = join(repo, '.claude', 'phasing')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'archive' && existsSync(join(root, d.name, 'run.json')))
    .map(d => {
      const runDir = join(root, d.name)
      let raw = {}
      try {
        raw = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))
      } catch {
        // Unparseable: listed as old format, which the old commands own.
      }
      const format = raw.schema === RUN_SCHEMA ? 'v3' : 'old'
      // v3 runs say `status`; old-format runs say `overall_status`.
      return { runId: d.name, runDir, format, status: (format === 'v3' ? raw.status : raw.overall_status) ?? null }
    })
}

export function lastActivity(run, runDir) {
  const times = [Date.parse(run.updated_at)]
  for (const f of readdirSync(runDir, { withFileTypes: true })) {
    // A temp file can be renamed away between listing and stat during a concurrent write.
    if (f.isFile()) times.push(statSync(join(runDir, f.name), { throwIfNoEntry: false })?.mtimeMs ?? NaN)
  }
  return new Date(Math.max(...times.filter(Number.isFinite)))
}

export const isStale = (last, now) => now.getTime() - last.getTime() > STALE_DAYS * DAY_MS

export function renderRun(run, flags, next = nextAction(run)) {
  const codes = n => flags.filter(f => f.n === n).map(f => f.code)
  const rows = run.phases.map(p => {
    const pr = p.pr === null ? '—' : `#${p.pr} ${p.ci ?? '—'}`
    const status = p.status === 'complete' && p.verified ? 'complete ✓' : p.status
    return `| ${p.n} | ${p.type} | ${status} | ${pr} | ${waitingOn(p, codes(p.n))} |`
  })
  const nextLine = next.n === null ? next.kind : `${next.kind} ${next.n}`
  return [
    `Run ${run.run_id} · ${run.status} · next: ${nextLine}`,
    '',
    '| phase | type | status | PR/CI | waiting on |',
    '|---|---|---|---|---|',
    ...rows,
    ...(flags.length > 0 ? ['', ...flags.map(f => `- ${f.n === null || f.detail.startsWith('phase ') ? '' : `phase ${f.n}: `}${f.detail}`)] : []),
  ].join('\n')
}

export function renderList(entries, now) {
  const lines = entries
    .filter(e => e.status === 'in_progress' || (e.format === 'old' && e.status === null) || e.error !== undefined)
    .map(e => {
      if (e.error !== undefined) return `- ${e.runId}: unreadable run.json (${e.error})`
      if (e.format === 'old') return `- ${e.runId}: old format: use /phase-status`
      const days = Math.floor((now.getTime() - e.last.getTime()) / DAY_MS)
      const next = e.next.n === null ? e.next.kind : `${e.next.kind} ${e.next.n}`
      return `- ${e.runId}: next ${next}${isStale(e.last, now) ? ` · stale (idle ${days}d)` : ''}`
    })
  return lines.length > 0 ? lines.join('\n') : 'No runs in flight in this repo.'
}

function view(runDir, deps) {
  const run = readRun(runDir)
  const { run: now, flags } = reconcile(run, gatherFacts(run, runDir, deps))
  return { run: now, flags, next: nextAction(now) }
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  if (flags.repo === true) throw new Error('--repo needs a path')
  const repo = typeof flags.repo === 'string' ? flags.repo : mainRoot(deps.cwd ?? process.cwd(), deps)
  const [runId] = positional
  if (runId !== undefined) {
    const entry = listRuns(repo).find(e => e.runId === runId)
    if (entry === undefined) return { text: `no run ${runId} in ${repo} (archived runs live under .claude/phasing/archive/)` }
    if (entry.format === 'old') return { text: `${runId}: old format: use /phase-status` }
    const { run, flags: found, next } = view(entry.runDir, deps)
    return { text: renderRun(run, found, next) }
  }
  // Only in-flight v3 runs are reconciled: each costs agent-view and GitHub calls. A broken run
  // is reported by name and never hides the others.
  const entries = listRuns(repo).map(e => {
    if (e.format === 'old' || e.status !== 'in_progress') return e
    try {
      const { run, next } = view(e.runDir, deps)
      return { ...e, run, next, last: lastActivity(run, e.runDir) }
    } catch (err) {
      return { ...e, error: err.message }
    }
  })
  return { text: renderList(entries, deps.now()) }
}

cli(import.meta.url, main)
