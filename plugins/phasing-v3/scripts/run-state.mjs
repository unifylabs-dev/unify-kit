#!/usr/bin/env node
// run-state: create a run, find it from a phase worktree, mark a phase verified, show it.
//   init <run-dir> --run-id <id> --repo <path> --base <branch> --phases '<json>'
//   locate <run-id>
//   mark-verified <run-dir> <n>
//   show <run-dir>
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { cli, parseFlags } from './lib/deps.mjs'
import { mainRoot, newRun, phaseOf, readRun, validateRun, writeRun } from './lib/run-state.mjs'

const USAGE = 'usage: run-state.mjs init|locate|mark-verified|show ...'

export function main(argv, deps) {
  const [cmd, ...rest] = argv
  const { positional, flags } = parseFlags(rest)
  switch (cmd) {
    case 'init': {
      const [runDir] = positional
      for (const key of ['run-id', 'repo', 'base', 'phases']) {
        if (typeof flags[key] !== 'string') throw new Error(`init needs --${key}`)
      }
      if (runDir === undefined) throw new Error('init needs <run-dir>')
      if (existsSync(join(runDir, 'run.json'))) throw new Error(`run.json already exists in ${runDir}`)
      const run = newRun({ runId: flags['run-id'], repo: flags.repo, baseBranch: flags.base, phases: JSON.parse(flags.phases) }, deps.now())
      const errors = validateRun(run)
      if (errors.length > 0) throw new Error(errors.join('; '))
      mkdirSync(runDir, { recursive: true })
      return writeRun(runDir, run, deps.now())
    }
    case 'locate': {
      const [runId] = positional
      if (runId === undefined) throw new Error('locate needs <run-id>')
      const root = mainRoot(deps.cwd ?? process.cwd(), deps)
      const runDir = join(root, '.claude', 'phasing', runId)
      if (!existsSync(join(runDir, 'run.json'))) throw new Error(`no run ${runId} under ${root}`)
      return { runDir }
    }
    case 'mark-verified': {
      const [runDir, n] = positional
      const run = readRun(runDir)
      const phase = phaseOf(run, Number(n))
      // Only a finished phase can pass the second pair of eyes.
      if (phase.status !== 'complete') throw new Error(`phase ${n} is ${phase.status}, not complete`)
      phase.verified = true
      return writeRun(runDir, run, deps.now())
    }
    case 'show':
      return readRun(positional[0])
    default:
      throw new Error(USAGE)
  }
}

cli(import.meta.url, main)
