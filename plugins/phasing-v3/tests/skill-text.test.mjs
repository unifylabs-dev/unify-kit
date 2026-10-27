// Checks on the skill and command text: the rules a prompt has to keep as models change.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

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

