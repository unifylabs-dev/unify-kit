// Checks on the skill and command text: the rules a prompt has to keep as models change.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateRows } from '../scripts/acceptance.mjs'
import { readHandoff } from '../scripts/lib/run-state.mjs'
import { tmpDir } from './helpers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXECUTOR = join(ROOT, 'skills', 'phasing-v3-execute', 'SKILL.md')

function globMd(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? globMd(join(dir, d.name)) : d.name.endsWith('.md') ? [join(dir, d.name)] : [])
}
const md = () => [...globMd(join(ROOT, 'skills')), ...globMd(join(ROOT, 'commands'))]
const read = f => readFileSync(f, 'utf8')
const lines = f => read(f).split('\n').length

// Top-level `key: value` pairs of the frontmatter block.
function frontmatter(f) {
  const block = /^---\n([\s\S]*?)\n---/.exec(read(f))
  assert.ok(block, `${f} has no frontmatter`)
  return Object.fromEntries(block[1].split('\n').map(l => /^([a-z-]+):\s*(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2]]))
}

// Relative links: markdown links and backticked references/*.md paths.
function links(f) {
  const t = read(f)
  const md = [...t.matchAll(/\]\(([^)#\s]+)\)/g)].map(m => m[1]).filter(l => !/^[a-z]+:/.test(l))
  const ticks = [...t.matchAll(/`(references\/[a-z0-9-]+\.md)`/g)].map(m => m[1])
  return [...new Set([...md, ...ticks])]
}

test('executor frontmatter uses only upload-safe keys', () => {
  const fm = frontmatter(EXECUTOR)
  assert.equal(fm.name, 'phasing-v3-execute')
  for (const k of Object.keys(fm)) assert.ok(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'].includes(k), k)
})

test('executor SKILL.md stays short', () => assert.ok(lines(EXECUTOR) <= 225, `${lines(EXECUTOR)} lines`))

test('skill text is calm and portable', () => {
  const files = md()
  assert.ok(files.length > 0)
  for (const f of files) {
    const t = read(f)
    assert.doesNotMatch(t, /\b(MUST|NEVER|CRITICAL|ALWAYS|MANDATORY|IMPORTANT)\b/, f)
    assert.doesNotMatch(t, /\b(opus|sonnet|haiku|fable)[ -]?\d/i, f)
    assert.doesNotMatch(t, /\b\d{3}k\b|\b1M\b/, f)
    assert.doesNotMatch(t, /\bTomer\b/, f)
  }
})

test('commands disable model invocation', () => {
  const commands = md().filter(f => f.includes('/commands/'))
  assert.ok(commands.length > 0)
  for (const f of commands) assert.equal(frontmatter(f)['disable-model-invocation'], 'true', f)
})

test('relative links in each SKILL.md resolve, and references link no further', () => {
  for (const f of md().filter(x => x.endsWith('SKILL.md'))) {
    for (const l of links(f)) assert.ok(existsSync(join(dirname(f), l)), `${f} → ${l}`)
  }
  for (const f of md().filter(x => x.includes('/references/'))) {
    assert.deepEqual(links(f).filter(l => l.includes('references/') || l.endsWith('.md')), [], f)
  }
})

test('the handoff template parses with readHandoff', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3-execute', 'references', 'handoff.md'))
  const block = /```(?:yaml|markdown|md)?\n(---\n[\s\S]*?\n---)\n/.exec(t)
  assert.ok(block, 'handoff.md shows the frontmatter in a fenced block')
  const phase = Number(/^phase: (\d+)$/m.exec(block[1])[1])
  const dir = tmpDir()
  writeFileSync(join(dir, `phase-${phase}-handoff.md`), `${block[1]}\n`)
  assert.ok(['complete', 'partial', 'failed'].includes(readHandoff(dir, phase).status))
})

test('the acceptance reference names every row field', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3-execute', 'references', 'acceptance.md'))
  for (const k of ['id', 'requirement', 'phase', 'status', 'evidence', 'carried_from', 'deadline_phase']) assert.ok(t.includes(`\`${k}\``), k)
})

test('the executor command names the executor skill', () => {
  assert.match(read(join(ROOT, 'commands', 'ph3-execute.md')), /phasing-v3-execute/)
})


const ORCH = join(ROOT, 'skills', 'phasing-v3', 'SKILL.md')

test('orchestrator SKILL.md stays short', () => assert.ok(lines(ORCH) <= 275, `${lines(ORCH)} lines`))

test('/ph3-next handles every next action', () => {
  const t = read(ORCH)
  for (const k of ['wait', 'verify', 'continue', 'relaunch', 'launch', 'closeout', 'inactive']) assert.match(t, new RegExp(`\`${k}\``), k)
})

test('every script the skills name exists', () => {
  const named = new Set(md().flatMap(f => [...read(f).matchAll(/\b([a-z-]+\.mjs)\b/g)].map(m => m[1])))
  assert.ok(named.size >= 6, [...named].join(', '))
  for (const s of named) assert.ok(existsSync(join(ROOT, 'scripts', s)), s)
})

test('the master-plan template has the required headings', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3', 'references', 'master-plan.md'))
  for (const h of ['TL;DR', 'Phases', 'Decisions', 'Facts', 'Out of scope', 'Run success criteria']) assert.ok(t.includes(h), h)
})

test('four commands exist', () => assert.deepEqual(readdirSync(join(ROOT, 'commands')).sort(), ['ph3-execute.md', 'ph3-next.md', 'ph3-status.md', 'ph3.md']))

test('the executor pushes and opens the PR before the checks, and writes the final handoff last', () => {
  const finish = read(EXECUTOR).split('## Finish')[1].split('\n## ')[0]
  const at = s => { const i = finish.indexOf(s); assert.ok(i >= 0, s); return i }
  assert.ok(at('git push') < at('review round'))
  assert.ok(at('review round') < at('final `phase-N-handoff.md`'))
})

test('the handoff session name comes from agent view first', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3-execute', 'references', 'handoff.md'))
  const bullet = t.split('- `session`:')[1].split('\n\n')[0]
  assert.ok(bullet.indexOf('claude agents --json') >= 0 && bullet.indexOf('claude agents --json') < bullet.indexOf('run.json'), bullet)
})

test('the brief names the PR base, and a continuation settles open questions first', () => {
  assert.match(read(join(ROOT, 'skills', 'phasing-v3', 'references', 'brief.md')), /PR base/)
  assert.match(read(EXECUTOR), /blocking_questions/)
  assert.match(read(EXECUTOR).split('## Start')[1].split('\n## ')[0], /decisions\.md/)
})

// The orchestrator text has to match what the scripts do (Task 10 review).
const bullet = (t, k) => t.split(`- \`${k}\`:`)[1].split('\n   - `')[0]

test('every flag the skills pass to a script is one the script documents', () => {
  for (const f of md()) {
    for (const [, script, args] of read(f).matchAll(/`(?:node \S*?)?([a-z-]+\.mjs)\b([^`]*)`/g)) {
      const src = read(join(ROOT, 'scripts', script))
      for (const [, flag] of args.matchAll(/--([a-z][a-z-]*)/g)) assert.match(src, new RegExp(`--${flag}(?![a-z-])`), `${f}: ${script} --${flag}`)
    }
  }
})

test('a relaunch and a fix session exclude the sessions that handed over', () => {
  const t = read(ORCH)
  for (const k of ['relaunch', 'verify']) assert.match(bullet(t, k), /launch\.mjs <run-dir> <N> --exclude-handed-over/, k)
  // The fix note the orchestrator writes is one the executor reads.
  assert.match(bullet(t, 'verify'), /## Fix after verify/)
  assert.match(read(EXECUTOR).split('## Start')[1].split('\n## ')[0], /## Fix after verify/)
})

test('after a merge, the run is reconciled again before the next worktree', () => {
  const t = read(ORCH)
  const merge = t.indexOf('gh pr merge')
  assert.ok(merge >= 0)
  const again = t.indexOf('reconcile.mjs <run-dir> --write', merge)
  assert.ok(again > merge && again < t.indexOf('worktree.mjs create', merge), 'reconcile after the merge, before worktree.mjs create')
})

test('an unreadable handoff is repaired before acting on next', () => {
  const step = read(ORCH).split('1. **Reconcile.**')[1].split('\n2. ')[0]
  assert.match(step, /`handoff-unreadable`/)
  assert.match(step.split('handoff-unreadable')[1], /reconcile again/i)
})

test('a continuation asks in the one batch and reports its launch like a launch', () => {
  const t = read(ORCH)
  const cont = bullet(t, 'continue')
  assert.match(cont, /step 4/)
  assert.match(cont, /decisions\.md/)
  for (const r of ['launch-unconfirmed', 'launch-failed', 'not-partial']) assert.ok(t.includes(`\`${r}\``), r)
})

test('verify handles broken rows, CI that is not a pass, and the last phase', () => {
  const v = bullet(read(ORCH), 'verify')
  for (const s of ['`valid`', 'acceptance.json', '`pending`', '`null`', 'last phase']) assert.ok(v.includes(s), s)
})

test('closeout finds the run pull requests by prefix and commits from its own worktree', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3', 'references', 'closeout.md'))
  assert.match(t, /--search "head:phase\/<run-id>\/"/)
  assert.doesNotMatch(t, /--head phase\//)
  assert.match(t, /git worktree add/)
  assert.doesNotMatch(t, /git (switch|checkout)\b/)
})

// Final review, skill-text seat.
test('/ph3 uses brainstorming for the conversation only, and checks the rows before the run starts', () => {
  const start = read(ORCH).split('## `/ph3 [task]`')[1].split('\n## ')[0]
  assert.match(start.split('1. **Intent.**')[1].split('\n2. ')[0], /writing-plans/)
  assert.match(start, /acceptance\.mjs check <run-dir> 1/)
})

test('the acceptance reference shows a row that validates, and asks for a row in every phase', () => {
  const t = read(join(ROOT, 'skills', 'phasing-v3-execute', 'references', 'acceptance.md'))
  const block = /```json\n([\s\S]*?)\n```/.exec(t)
  assert.ok(block, 'acceptance.md shows an example in a fenced json block')
  assert.deepEqual(validateRows(JSON.parse(block[1])), [])
  assert.match(t, /at least one row/)
})

test('a run that is not in progress, or that the user stops, goes to park or abandon', () => {
  const t = read(ORCH)
  assert.match(bullet(t, 'inactive').split('\n3. ')[0], /references\/closeout\.md/)
  assert.match(bullet(t, 'relaunch'), /references\/closeout\.md/)
})

test('verify follows through on accept or amend, and treats unknown CI like pending', () => {
  const v = bullet(read(ORCH), 'verify')
  const at = v.indexOf('**Accept as is:**')
  assert.ok(at >= 0 && v.indexOf('mark-verified', at) > at, 'accept as is runs mark-verified')
  assert.match(v, /\*\*Amend the plan:\*\*/)
  assert.match(v, /`unknown`/)
})

test('merges go in phase order, and a stacked PR is retargeted before it merges', () => {
  const step = read(ORCH).split('4. **One batch of real questions**')[1].split('\n5. ')[0]
  assert.match(step, /oldest first/)
  assert.ok(step.indexOf('gh pr edit <pr> --base') >= 0 && step.indexOf('gh pr edit <pr> --base') < step.indexOf('reconcile.mjs'))
})

test('the pause stops this session\'s background work before the fresh session can start', () => {
  const pause = read(EXECUTOR).split('## Pause at about half the context')[1].split('\n## ')[0]
  const stop = pause.indexOf('background')
  assert.ok(stop >= 0 && stop < pause.indexOf('End the turn'), 'background work stops before the turn ends')
})

test('no phase type claims to run in the cloud while the run folder is local', () => {
  assert.doesNotMatch(read(join(ROOT, 'skills', 'phasing-v3-execute', 'references', 'phase-types.md')), /Cloud-capable: (usually )?yes/)
})

test('a launch refused for an untrusted workspace tells the user how to trust the repo', () => {
  // Task 13: claude --bg refuses an untrusted cwd; trust carries from the repo to its phase worktrees.
  const launchStep = read(ORCH).split('3. Run `launch.mjs <run-dir> <N>`.')[1].split('\n6. ')[0]
  assert.match(launchStep, /not trusted/)
})

test('the partial handoff is written with the Write tool, which context-watch records', () => {
  // Task 13: a phase session wrote its handoff through Bash; the mod sees only a Write.
  const pause = read(EXECUTOR).split('## Pause at about half the context')[1].split('\n## ')[0]
  assert.match(pause.split('3. ')[1].split('\n4. ')[0], /Write\s+tool/)
})
