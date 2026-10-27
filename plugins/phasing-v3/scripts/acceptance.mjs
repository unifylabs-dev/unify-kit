#!/usr/bin/env node
// acceptance.json: one row per requirement, the phase that owns it, and the evidence that it is met.
// JSON, not Markdown: models are less likely to rewrite or drop rows in JSON. "Deferred" is not a
// status; an open row may carry to the next phase once, then it is met, dropped, or escalated.
//   check <run-dir> <n>
//   due <run-dir> <next-phase>
//   carry <run-dir> <id> <to-phase>
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { cli } from './lib/deps.mjs'

export const ROW_STATUS = ['open', 'met', 'dropped']

const isWhole = v => Number.isInteger(v) && v >= 1
const rowsFile = runDir => join(runDir, 'acceptance.json')

export function validateRows(rows) {
  if (!Array.isArray(rows)) return ['acceptance.json must be an array']
  const errors = []
  const seen = new Set()
  for (const r of rows) {
    const id = typeof r?.id === 'string' && r.id !== '' ? r.id : null
    if (id === null) {
      errors.push(`row without an id: ${JSON.stringify(r)}`)
      continue
    }
    if (seen.has(id)) errors.push(`duplicate id ${id}`)
    seen.add(id)
    if (typeof r.requirement !== 'string' || r.requirement.trim() === '') errors.push(`${id}: requirement is empty`)
    if (!isWhole(r.phase)) errors.push(`${id}: phase must be a whole number from 1`)
    if (!ROW_STATUS.includes(r.status)) errors.push(`${id}: status ${r.status} is not one of ${ROW_STATUS.join(', ')}`)
    if (typeof r.evidence !== 'string') errors.push(`${id}: evidence must be a string`)
    else if (r.status === 'met' && r.evidence.trim() === '') errors.push(`${id}: met without evidence`)
    if (r.carried_from !== null && !isWhole(r.carried_from)) errors.push(`${id}: carried_from must be null or a phase number`)
    if (r.deadline_phase !== null && !isWhole(r.deadline_phase)) errors.push(`${id}: deadline_phase must be null or a phase number`)
    if (isWhole(r.carried_from)) {
      if (r.deadline_phase === null) errors.push(`${id}: a carried row needs deadline_phase`)
      else if (r.deadline_phase > r.carried_from + 1) {
        errors.push(`${id}: deadline_phase ${r.deadline_phase} exceeds carried_from + 1 (${r.carried_from + 1})`)
      }
    }
  }
  return errors
}

export function phaseSummary(rows, n) {
  const ids = status => rows.filter(r => r.phase === n && r.status === status).map(r => r.id)
  return { met: ids('met'), open: ids('open'), dropped: ids('dropped') }
}

export function isPhaseComplete(rows, n) {
  const own = rows.filter(r => r.phase === n)
  return own.length > 0 && own.every(r => r.status === 'met' || r.status === 'dropped')
}

// What must be settled before the next phase starts: carried rows past their deadline, and open
// rows left behind in a finished phase that nobody carried.
export function due(rows, nextPhase) {
  const open = rows.filter(r => r.status === 'open')
  return {
    overdue: open.filter(r => r.deadline_phase !== null && r.deadline_phase < nextPhase).map(r => r.id),
    uncarried: open.filter(r => r.phase < nextPhase && r.carried_from === null).map(r => r.id),
  }
}

// One carry, one phase forward. A second carry is the signal to drop the row or turn it into a
// decision: in past runs, carried items piled up in the last phase.
export function carry(rows, id, toPhase) {
  const r = rows.find(x => x.id === id)
  if (r === undefined) throw new Error(`no row ${id}`)
  if (r.carried_from !== null) throw new Error(`${id} is already carried once; drop it or escalate it as a decision`)
  if (r.status !== 'open') throw new Error(`${id} is ${r.status}; only open rows carry`)
  if (toPhase !== r.phase + 1) throw new Error(`${id} can carry one phase only (${r.phase} → ${r.phase + 1})`)
  return rows.map(x => (x.id === id ? { ...x, phase: toPhase, carried_from: r.phase, deadline_phase: toPhase } : x))
}

export function readRows(runDir) {
  const path = rowsFile(runDir)
  if (!existsSync(path)) throw new Error(`acceptance.json missing in ${runDir}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`acceptance.json is not valid JSON: ${e.message}`)
  }
}

export function writeRows(runDir, rows) {
  const errors = validateRows(rows)
  if (errors.length > 0) throw new Error(`refusing to write invalid acceptance.json: ${errors.join('; ')}`)
  const path = rowsFile(runDir)
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(rows, null, 2)}\n`)
  renameSync(tmp, path)
}

function validRows(runDir) {
  const rows = readRows(runDir)
  const errors = validateRows(rows)
  if (errors.length > 0) throw new Error(`acceptance.json is invalid: ${errors.join('; ')}`)
  return rows
}

export function main(argv) {
  const [cmd, runDir, ...rest] = argv
  switch (cmd) {
    case 'check': {
      const n = Number(rest[0])
      const rows = readRows(runDir)
      const errors = validateRows(rows)
      const valid = errors.length === 0
      return { valid, errors, summary: valid ? phaseSummary(rows, n) : null, complete: valid && isPhaseComplete(rows, n) }
    }
    case 'due':
      return due(validRows(runDir), Number(rest[0]))
    case 'carry': {
      const [id, to] = rest
      const rows = carry(validRows(runDir), id, Number(to))
      writeRows(runDir, rows)
      return rows.find(r => r.id === id)
    }
    default:
      throw new Error('usage: acceptance.mjs check|due|carry <run-dir> ...')
  }
}

cli(import.meta.url, main)
