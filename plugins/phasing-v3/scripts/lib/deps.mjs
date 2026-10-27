// The outside world, injected: commands, the clock and waiting. Tests pass fakes; the CLIs pass
// realDeps. Every script prints one JSON object, so a skill can read its result without parsing prose.
import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const realDeps = {
  // Synchronous on purpose: the scripts are short, sequential, and easier to reason about this way.
  exec(cmd, args = [], { cwd, timeoutMs = 30_000 } = {}) {
    // spawnSync reports a missing cwd as ENOENT too; name it, so it is not mistaken for a missing command.
    if (cwd !== undefined && !existsSync(cwd)) return { code: 1, stdout: '', stderr: `no such directory: ${cwd}` }
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 })
    if (r.error?.code === 'ENOENT') return { code: 127, stdout: '', stderr: `not found: ${cmd}` }
    if (r.error) return { code: 1, stdout: r.stdout ?? '', stderr: r.error.message }
    return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr }
  },
  now: () => new Date(),
  sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  },
}

// `--key value` pairs and bare `--flag` switches; everything else is positional.
export function parseFlags(args) {
  const positional = []
  const flags = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('--')) positional.push(a)
    else if (i + 1 < args.length && !args[i + 1].startsWith('--')) flags[a.slice(2)] = args[++i]
    else flags[a.slice(2)] = true
  }
  return { positional, flags }
}

// Runs main only when the file is the process entry point. The script may be reached through the
// skills-dir symlink, so both sides are compared as real paths.
export function cli(importMetaUrl, main) {
  const entry = process.argv[1]
  if (!entry || importMetaUrl !== pathToFileURL(realpathSync(entry)).href) return
  try {
    const out = main(process.argv.slice(2), realDeps)
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } catch (e) {
    process.stderr.write(`${JSON.stringify({ error: e.message })}\n`)
    process.exitCode = 1
  }
}
