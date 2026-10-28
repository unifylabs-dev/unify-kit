import assert from 'node:assert/strict'
import { test } from 'node:test'

import { carry, due, isPhaseComplete, main, phaseSummary, readRows, validateRows, writeRows } from '../scripts/acceptance.mjs'
import { fakeDeps, seedRun, tmpDir } from './helpers.mjs'

const row = overrides => ({ id: 'A', requirement: 'r', phase: 1, status: 'open', evidence: '', carried_from: null, deadline_phase: null, ...overrides })
const pick = (obj, ...keys) => Object.fromEntries(keys.map(k => [k, obj[k]]))

test('validateRows names each broken rule', () => {
  const errors = validateRows([
    row({ id: 'A1' }), row({ id: 'A1' }), row({ id: 'A2', status: 'deferred' }),
    row({ id: 'A3', status: 'met', evidence: '' }), row({ id: 'A4', carried_from: 2, deadline_phase: 4 }),
  ]).join('\n')
  for (const s of ['duplicate id A1', 'A2: status deferred', 'A3: met without evidence',
    'A4: deadline_phase 4 exceeds carried_from + 1']) assert.ok(errors.includes(s), s)
})

test('isPhaseComplete needs rows, all met or dropped', () => {
  assert.equal(isPhaseComplete([], 1), false)
  assert.equal(isPhaseComplete([row({ status: 'met', evidence: 'ci #4' }), row({ id: 'B', status: 'dropped' })], 1), true)
  assert.equal(isPhaseComplete([row({ status: 'open' })], 1), false)
})

test('phaseSummary groups one phase by status', () => {
  const rows = [row({ id: 'A1', status: 'met', evidence: 'test' }), row({ id: 'A2' }), row({ id: 'A3', status: 'dropped' }), row({ id: 'B1', phase: 2 })]
  assert.deepEqual(phaseSummary(rows, 1), { met: ['A1'], open: ['A2'], dropped: ['A3'], carried: [] })
})

test('due lists overdue carries and uncarried leftovers', () => {
  const rows = [row({ id: 'A1', phase: 2, carried_from: 1, deadline_phase: 2 }), row({ id: 'A2', phase: 1 }), row({ id: 'A3', phase: 3 })]
  assert.deepEqual(due(rows, 3), { overdue: ['A1'], uncarried: ['A2'] })
})

test('carry moves a row one phase, once', () => {
  const moved = carry([row({ id: 'A2', phase: 1 })], 'A2', 2)
  assert.deepEqual(pick(moved[0], 'phase', 'carried_from', 'deadline_phase'), { phase: 2, carried_from: 1, deadline_phase: 2 })
  assert.throws(() => carry(moved, 'A2', 3), /already carried/)
  assert.throws(() => carry([row({ id: 'A5', phase: 1 })], 'A5', 3), /one phase/)
})

test('CLI check and carry work on the run folder', () => {
  const runDir = seedRun(tmpDir())
  writeRows(runDir, [row({ id: 'A1', status: 'met', evidence: 'ci #4' }), row({ id: 'A2' })])
  assert.deepEqual(main(['check', runDir, '1'], fakeDeps()),
    { valid: true, errors: [], summary: { met: ['A1'], open: ['A2'], dropped: [], carried: [] }, complete: false })
  main(['carry', runDir, 'A2', '2'], fakeDeps())
  assert.equal(readRows(runDir)[1].phase, 2)
  assert.deepEqual(main(['due', runDir, '2'], fakeDeps()), { overdue: [], uncarried: [] })
})

test('CLI rejects a missing or non-numeric phase', () => {
  const runDir = seedRun(tmpDir())
  writeRows(runDir, [row({ id: 'A1' })])
  assert.throws(() => main(['due', runDir], fakeDeps()), /phase/)
  assert.throws(() => main(['check', runDir, 'x'], fakeDeps()), /phase/)
})

test('a carried row must sit exactly one phase after its origin', () => {
  const errors = validateRows([row({ id: 'C1', phase: 1, carried_from: 7, deadline_phase: 8 }),
    row({ id: 'C2', phase: 3, carried_from: 1, deadline_phase: 2 })]).join('\n')
  assert.ok(errors.includes('C1: carried_from 7 must be phase - 1'), errors)
  assert.ok(errors.includes('C2: carried_from 1 must be phase - 1'), errors)
})

test('nothing carries past the last phase', () => {
  assert.throws(() => carry([row({ id: 'A1', phase: 2 })], 'A1', 3, 2), /last phase/)
  assert.ok(validateRows([row({ id: 'A1', phase: 3 })], 2).join('\n').includes('A1: phase 3 is past the last phase 2'))
  const runDir = seedRun(tmpDir())
  writeRows(runDir, [row({ id: 'A1', phase: 2 })])
  assert.throws(() => main(['carry', runDir, 'A1', '3'], fakeDeps()), /last phase/)
})

test('a phase with an open carried-out row is not complete', () => {
  const rows = [row({ id: 'A1', status: 'met', evidence: 'ci' }), row({ id: 'A2', phase: 2, carried_from: 1, deadline_phase: 2 })]
  assert.equal(isPhaseComplete(rows, 1), false)
  assert.deepEqual(phaseSummary(rows, 1), { met: ['A1'], open: [], dropped: [], carried: ['A2'] })
})
