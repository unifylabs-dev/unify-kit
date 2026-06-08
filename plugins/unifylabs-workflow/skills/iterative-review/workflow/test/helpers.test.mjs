// helpers.test.mjs — node:test for the three pure helpers: mode-detect,
// verifier-detect, parse-findings. Non-trivial cases incl. doc vs code, a
// package.json with/without a test script, and findings with an explicit
// severity tag vs a score-derived tier.
//
// Zero-dep: node:test + node:assert only. NO wall-clock, NO random (scanned by
// the recursive determinism guard).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectMode } from '../lib/mode-detect.mjs';
import { resolveVerifier } from '../lib/verifier-detect.mjs';
import { normalizeFindings } from '../lib/parse-findings.mjs';

// ---------------------------------------------------------------------------
// mode-detect
// ---------------------------------------------------------------------------

test('detectMode: doc extensions resolve to doc', () => {
  assert.equal(detectMode('notes.md'), 'doc');
  assert.equal(detectMode('a/b/file.txt'), 'doc');
  assert.equal(detectMode('README.rst'), 'doc');
  assert.equal(detectMode('page.mdx'), 'doc');
});

test('detectMode: doc roots resolve to doc even for non-doc extensions', () => {
  assert.equal(detectMode('docs/architecture.png'), 'doc');
  assert.equal(detectMode('specs/module-x'), 'doc');
  assert.equal(detectMode('plans/q3'), 'doc');
  assert.equal(detectMode('./docs/thing.json'), 'doc');
  assert.equal(detectMode('repo/subdir/docs/guide.json'), 'doc');
});

test('detectMode: a directory NAMED like a doc-root substring is NOT a doc', () => {
  // 'mydocs/' should not match the 'docs/' root (segment boundary required).
  assert.equal(detectMode('mydocs/file.ts'), 'code');
  assert.equal(detectMode('subspecs/x.ts'), 'code');
});

test('detectMode: PR numbers and code files resolve to code', () => {
  assert.equal(detectMode('47'), 'code');
  assert.equal(detectMode('src/index.ts'), 'code');
  assert.equal(detectMode('lib/foo.py'), 'code');
  assert.equal(detectMode(''), 'code');
});

test('detectMode: a phase arg resolves to phase', () => {
  assert.equal(detectMode('phase 2026-05-12-foo 2'), 'phase');
  assert.equal(detectMode('phase'), 'phase');
});

// ---------------------------------------------------------------------------
// verifier-detect
// ---------------------------------------------------------------------------

test('resolveVerifier: package.json WITH a test script yields npm test', () => {
  const cmds = resolveVerifier({
    packageJson: JSON.stringify({ scripts: { test: 'jest' } }),
  });
  assert.deepEqual(cmds, ['npm test --silent']);
});

test('resolveVerifier: package.json WITHOUT a test script yields no test command', () => {
  const cmds = resolveVerifier({
    packageJson: JSON.stringify({ scripts: { lint: 'eslint .' } }),
  });
  assert.deepEqual(cmds, ['npm run lint']);
  assert.ok(!cmds.includes('npm test --silent'));
});

test('resolveVerifier: multiple scripts emit in table order (test, typecheck, build, lint)', () => {
  const cmds = resolveVerifier({
    packageJson: {
      scripts: { build: 'tsc -b', test: 'vitest', lint: 'eslint .', typecheck: 'tsc --noEmit' },
    },
  });
  assert.deepEqual(cmds, [
    'npm test --silent',
    'npm run typecheck',
    'npm run build',
    'npm run lint',
  ]);
});

test('resolveVerifier: a pnpm lockfile swaps the runner', () => {
  const cmds = resolveVerifier({
    packageJson: { scripts: { test: 'vitest', build: 'vite build' } },
    lockfiles: ['pnpm-lock.yaml'],
  });
  assert.deepEqual(cmds, ['pnpm test --silent', 'pnpm run build']);
});

test('resolveVerifier: bun + yarn lockfile precedence (yarn wins over bun)', () => {
  const cmds = resolveVerifier({
    packageJson: { scripts: { test: 't' } },
    lockfiles: ['bun.lockb', 'yarn.lock'],
  });
  assert.deepEqual(cmds, ['yarn test --silent']);
});

test('resolveVerifier: pyproject sections map to pytest/mypy/ruff', () => {
  const cmds = resolveVerifier({
    pyprojectToml: '[tool.pytest.ini_options]\n[tool.mypy]\n[tool.ruff]\n',
  });
  assert.deepEqual(cmds, ['pytest -x --tb=short', 'mypy .', 'ruff check']);
});

test('resolveVerifier: Cargo / Go / Makefile markers', () => {
  assert.deepEqual(resolveVerifier({ otherFiles: ['Cargo.toml'] }), [
    'cargo test --quiet',
    'cargo check',
  ]);
  assert.deepEqual(resolveVerifier({ otherFiles: ['go.mod'] }), [
    'go test ./...',
    'go vet ./...',
  ]);
  assert.deepEqual(
    resolveVerifier({ makefile: 'build:\n\ttsc\ntest:\n\tnode --test\ncheck:\n\tlint\n' }),
    ['make test', 'make check'],
  );
});

test('resolveVerifier: legacy python needs BOTH a marker file AND a tests/ dir', () => {
  assert.deepEqual(resolveVerifier({ otherFiles: ['requirements.txt'] }), []);
  assert.deepEqual(
    resolveVerifier({ otherFiles: ['requirements.txt', 'tests/'] }),
    ['pytest -x'],
  );
});

test('resolveVerifier: nothing recognized yields an empty list', () => {
  assert.deepEqual(resolveVerifier({}), []);
  assert.deepEqual(resolveVerifier(), []);
});

test('resolveVerifier: a malformed package.json string does not throw, yields []', () => {
  assert.deepEqual(resolveVerifier({ packageJson: '{ not json' }), []);
});

// ---------------------------------------------------------------------------
// parse-findings
// ---------------------------------------------------------------------------

test('normalizeFindings: explicit severity tag wins over the score', () => {
  // score 75 would be a suggestion, but the explicit critical tag overrides
  // (the security-finding case in severity-policy.md).
  const out = normalizeFindings([
    { file: 'auth.ts', line: 12, severity: 'critical', score: 75, description: 'ssrf' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[0].score, 75);
  assert.equal(out[0].file, 'auth.ts');
  assert.equal(out[0].line, 12);
});

test('normalizeFindings: tier derived from the score when no tag', () => {
  const out = normalizeFindings([
    { file: 'a', line: 1, score: 92, description: 'crit' },
    { file: 'b', line: 2, score: 85, description: 'imp' },
    { file: 'c', line: 3, score: 50, description: 'sug' },
  ]);
  assert.deepEqual(
    out.map((f) => f.severity),
    ['critical', 'important', 'suggestion'],
  );
});

test('normalizeFindings: accepts confidence as a score alias and a {findings:[]} wrapper', () => {
  const out = normalizeFindings({
    findings: [{ file: 'x', line: 9, confidence: 95, title: 'boom' }],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[0].score, 95);
  assert.equal(out[0].description, 'boom');
});

test('normalizeFindings: parses a JSON string', () => {
  const out = normalizeFindings(
    '[{"file":"x","line":1,"score":99,"description":"d"}]',
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'critical');
});

test('normalizeFindings: parses the doc-reviewer markdown report format', () => {
  const md = [
    '## Findings',
    '',
    '### [Critical] Broken file reference',
    '**Confidence:** 95/100',
    '**Location:** docs/spec.md:42',
    '**Issue:** the referenced file does not exist',
    '**Why it matters:** misleads the reader',
    '',
    '### [Important] Vague hedge blocks a decision',
    '**Confidence:** 84/100',
    '**Location:** docs/spec.md:88',
    '**Issue:** "might" used as an actionable statement',
    '',
    '### [Suggestion] Style nit',
    '**Confidence:** 60/100',
    '**Location:** docs/spec.md:5',
    '**Issue:** prefer active voice',
    '',
    '## Summary',
    '- Critical: 1',
  ].join('\n');
  const out = normalizeFindings(md);
  assert.equal(out.length, 3);
  assert.equal(out[0].severity, 'critical');
  assert.equal(out[0].file, 'docs/spec.md');
  assert.equal(out[0].line, 42);
  assert.equal(out[0].score, 95);
  assert.equal(out[0].description, 'the referenced file does not exist');
  assert.equal(out[1].severity, 'important');
  assert.equal(out[1].line, 88);
  assert.equal(out[2].severity, 'suggestion');
});

test('normalizeFindings: null / unparseable input yields an empty array', () => {
  assert.deepEqual(normalizeFindings(null), []);
  assert.deepEqual(normalizeFindings(undefined), []);
  assert.deepEqual(normalizeFindings('not json and not a finding heading'), []);
});
