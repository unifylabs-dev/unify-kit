#!/usr/bin/env node
// worktree: one git worktree and branch per phase, inside the main checkout under
// .claude/worktrees/. A continuation reuses the same worktree, so the phase keeps its place.
//   create <run-dir> <n> [--base <ref>]
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { phaseOf, readRun, writeRun } from './lib/run-state.mjs'

export const phaseBranch = (runId, n, slug) => `phase/${runId}/p${n}-${slug}`
export const worktreePath = (repo, runId, n) => join(repo, '.claude', 'worktrees', `${runId}-p${n}`)

// Phase 1 starts from the base branch. A later phase starts from the base branch once the previous
// phase's PR is merged, and stacks on the previous phase's branch while it is not.
export function baseFor(run, n) {
  if (n === 1) return run.base_branch
  const prev = phaseOf(run, n - 1)
  if (prev.pr_state === 'MERGED' || prev.branch === null) return run.base_branch
  return prev.branch
}

function git(deps, cwd, ...args) {
  const r = deps.exec('git', args, { cwd })
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`)
  return r.stdout.trim()
}

// Worktrees inside the checkout must stay out of `git status`. The exclude file is local to this
// clone, so no tracked file changes.
export function ensureIgnored(repo, deps) {
  if (deps.exec('git', ['check-ignore', '-q', '.claude/worktrees/x'], { cwd: repo }).code === 0) return false
  const exclude = join(git(deps, repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'info', 'exclude')
  mkdirSync(dirname(exclude), { recursive: true })
  const text = existsSync(exclude) ? readFileSync(exclude, 'utf8') : ''
  appendFileSync(exclude, `${text === '' || text.endsWith('\n') ? '' : '\n'}.claude/worktrees/\n`)
  return true
}

// The base branch is taken from the remote when there is one: a PR merged on GitHub never reaches
// the local base branch, and the next phase has to start from the merged result.
function resolveBase(run, base, deps) {
  if (base !== run.base_branch) return base
  const remotes = deps.exec('git', ['remote'], { cwd: run.repo })
  if (remotes.code !== 0 || !remotes.stdout.split('\n').includes('origin')) return base
  git(deps, run.repo, 'fetch', '-q', 'origin', base)
  return `origin/${base}`
}

const registeredWorktrees = (repo, deps) =>
  new Set(git(deps, repo, 'worktree', 'list', '--porcelain').split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9)))

export function createPhaseWorktree(runDir, n, base, deps) {
  const run = readRun(runDir)
  const phase = phaseOf(run, n)
  const branch = phaseBranch(run.run_id, n, phase.slug)
  const path = worktreePath(run.repo, run.run_id, n)
  ensureIgnored(run.repo, deps)
  let registered = registeredWorktrees(run.repo, deps)
  // A worktree folder deleted by hand stays registered until pruned, and blocks `worktree add`.
  if (registered.has(path) && !existsSync(path)) {
    git(deps, run.repo, 'worktree', 'prune')
    registered = registeredWorktrees(run.repo, deps)
  }
  let created = false
  if (existsSync(path)) {
    // Inside the main checkout, git in a plain folder would read the main checkout's HEAD.
    if (!registered.has(path)) throw new Error(`${path} exists but is not a git worktree; remove it and retry`)
    const current = git(deps, path, 'rev-parse', '--abbrev-ref', 'HEAD')
    if (current !== branch) throw new Error(`${path} exists on ${current}, not ${branch}`)
  } else {
    const hasBranch = deps.exec('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: run.repo }).code === 0
    if (hasBranch) git(deps, run.repo, 'worktree', 'add', '-q', path, branch)
    else git(deps, run.repo, 'worktree', 'add', '-q', '--no-track', '-b', branch, path, resolveBase(run, base, deps))
    created = true
  }
  if (phase.branch !== branch || phase.worktree !== path) {
    phase.branch = branch
    phase.worktree = path
    writeRun(runDir, run, deps.now())
  }
  return { branch, path, created }
}

export function main(argv, deps) {
  const { positional, flags } = parseFlags(argv)
  const [cmd, runDir, n] = positional
  if (cmd !== 'create' || runDir === undefined || n === undefined) throw new Error('usage: worktree.mjs create <run-dir> <n> [--base <ref>]')
  if (flags.base === true) throw new Error('--base needs a ref')
  const base = typeof flags.base === 'string' ? flags.base : baseFor(readRun(runDir), Number(n))
  return createPhaseWorktree(runDir, Number(n), base, deps)
}

cli(import.meta.url, main)
