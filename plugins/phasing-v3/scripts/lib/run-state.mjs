// run.json and the handoff frontmatter: the machine state of one run. run.json holds observed facts
// only (no prose), so commands can rebuild it from git, GitHub and the run folder at any time.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

export const RUN_SCHEMA = 'phasing-v3/1'
export const PHASE_STATUS = ['pending', 'running', 'partial', 'complete', 'failed']
export const RUN_STATUS = ['in_progress', 'complete', 'complete_unmet', 'parked', 'abandoned']
export const PHASE_TYPES = ['setup', 'design', 'build', 'tooling']
export const HANDOFF_STATUS = ['complete', 'partial', 'failed']
// Run ids and slugs become branch names and folder names, so they stay plain.
export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

export function newRun({ runId, repo, baseBranch, phases }, now) {
  const at = now.toISOString()
  return {
    schema: RUN_SCHEMA,
    run_id: runId,
    repo,
    base_branch: baseBranch,
    status: 'in_progress',
    reason: null,
    // Bumped on every write, so a writer holding a stale copy is refused instead of losing an update.
    rev: 0,
    phases: phases.map(({ n, slug, type }) => ({
      n, slug, type, status: 'pending', verified: false, branch: null, worktree: null,
      pr: null, pr_state: null, ci: null, sessions: [], auto_continuations: 0,
    })),
    created_at: at,
    updated_at: at,
  }
}

export function validateRun(run) {
  if (run === null || typeof run !== 'object') return ['run.json is not an object']
  const errors = []
  if (run.schema !== RUN_SCHEMA) errors.push(`schema must be ${RUN_SCHEMA}`)
  if (!NAME_RE.test(String(run.run_id ?? ''))) errors.push(`run_id "${run.run_id}" must be lowercase letters, digits and dashes`)
  if (typeof run.repo !== 'string' || !isAbsolute(run.repo)) errors.push(`repo "${run.repo}" must be an absolute path`)
  if (typeof run.base_branch !== 'string' || run.base_branch === '') errors.push('base_branch is missing')
  if (!Number.isInteger(run.rev) || run.rev < 0) errors.push('rev must be a whole number')
  if (!RUN_STATUS.includes(run.status)) errors.push(`status "${run.status}" is not one of ${RUN_STATUS.join(', ')}`)
  if (!Array.isArray(run.phases) || run.phases.length === 0) return [...errors, 'phases must be a non-empty array']
  const ns = run.phases.map(p => p.n)
  if (!ns.every((n, i) => n === i + 1)) errors.push(`phase numbers must run 1..${ns.length} in order, got ${ns.join(',')}`)
  for (const p of run.phases) {
    if (!NAME_RE.test(String(p.slug ?? ''))) errors.push(`phase ${p.n}: slug "${p.slug}" must be lowercase letters, digits and dashes`)
    if (!PHASE_TYPES.includes(p.type)) errors.push(`phase ${p.n}: type "${p.type}" is not one of ${PHASE_TYPES.join(', ')}`)
    if (!PHASE_STATUS.includes(p.status)) errors.push(`phase ${p.n}: status "${p.status}" is not one of ${PHASE_STATUS.join(', ')}`)
    if (!Array.isArray(p.sessions)) errors.push(`phase ${p.n}: sessions must be an array`)
    if (!Number.isInteger(p.auto_continuations) || p.auto_continuations < 0) errors.push(`phase ${p.n}: auto_continuations must be a whole number`)
  }
  return errors
}

const runFile = runDir => join(runDir, 'run.json')

export function readRun(runDir) {
  const path = runFile(runDir)
  if (!existsSync(path)) throw new Error(`run.json invalid: missing ${path}`)
  let run
  try {
    run = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`run.json invalid: ${e.message}`)
  }
  const errors = validateRun(run)
  if (errors.length > 0) throw new Error(`run.json invalid: ${errors.join('; ')}`)
  return run
}

// Temp file then rename, so a reader never sees half a file. Refuses to write an invalid run (a bad
// write would poison every later command) and a stale one: reconcile can spend seconds gathering
// facts while a continuation records its new session, and that session must not be lost.
export function writeRun(runDir, run, now) {
  const out = { ...run, rev: run.rev + 1, updated_at: now.toISOString() }
  const errors = validateRun(out)
  if (errors.length > 0) throw new Error(`refusing to write an invalid run.json: ${errors.join('; ')}`)
  const path = runFile(runDir)
  if (existsSync(path)) {
    let onDisk
    try {
      onDisk = JSON.parse(readFileSync(path, 'utf8')).rev
    } catch {
      onDisk = undefined
    }
    if (onDisk !== run.rev) throw new Error(`run.json changed on disk since it was read (rev ${onDisk}, expected ${run.rev}); read it again and retry`)
  }
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(out, null, 2)}\n`)
  renameSync(tmp, path)
  return out
}

export function phaseOf(run, n) {
  const phase = run.phases.find(p => p.n === n)
  if (phase === undefined) throw new Error(`no phase ${n}`)
  return phase
}

export const handoffPath = (runDir, n) => join(runDir, `phase-${n}-handoff.md`)

const unquote = v => v.replace(/^(["'])(.*)\1$/, '$2')

// The frontmatter is the machine-readable part of a handoff; the body is for people. A handoff
// the model wrote wrong comes back as `invalid`, never as a guess: a wrong guess could launch a
// continuation past an open question.
export function readHandoff(runDir, phaseNumber) {
  const n = Number(phaseNumber)
  const path = handoffPath(runDir, n)
  if (!existsSync(path)) return null
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(readFileSync(path, 'utf8'))
  if (block === null) return { status: 'invalid', error: 'no frontmatter block' }
  // Top-level keys only: an indented key belongs to a nested block and never overrides one.
  const fields = {}
  for (const line of block[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):[ \t]*(.*?)\s*$/.exec(line)
    if (kv === null) continue
    if (kv[1] in fields) return { status: 'invalid', error: `duplicate key ${kv[1]}` }
    fields[kv[1]] = unquote(kv[2])
  }
  const whole = v => typeof v === 'string' && /^\d+$/.test(v)
  if (!whole(fields.phase)) return { status: 'invalid', error: 'phase must be a whole number' }
  const phase = Number(fields.phase)
  if (phase !== n) return { status: 'invalid', error: `phase ${phase} does not match the file's phase ${n}` }
  if (!HANDOFF_STATUS.includes(fields.status)) {
    return { status: 'invalid', error: `status "${fields.status}" is not one of ${HANDOFF_STATUS.join(', ')}` }
  }
  if (!whole(fields.blocking_questions)) return { status: 'invalid', error: 'blocking_questions must be a whole number' }
  const blocking = Number(fields.blocking_questions)
  if (!fields.session) return { status: 'invalid', error: 'session is missing' }
  return { phase, status: fields.status, blocking_questions: blocking, session: fields.session }
}

// The main checkout, from the main checkout or any of its worktrees: the parent of the shared .git.
export function mainRoot(cwd, deps) {
  const r = deps.exec('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd })
  if (r.code !== 0) throw new Error(`not a git repository: ${cwd}`)
  return dirname(r.stdout.trim())
}
