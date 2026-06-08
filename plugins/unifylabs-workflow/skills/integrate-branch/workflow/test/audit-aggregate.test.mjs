// audit-aggregate.test.mjs — unit tests for the agent→reduce bridge transforms:
// D4 consensus (critVotes=1 dedup-only) + naive reference, and D2 role-tagging
// with the OD4 synthetic-tsc fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateD4, naiveD4, countSeverities, d2Bucket, resolveD2Commands, d2SignalsFromResults, D4_CRIT_VOTES,
} from '../audit-aggregate.mjs';

test('D4_CRIT_VOTES is 1 (OD2 dedup-only for distinct lenses)', () => {
  assert.equal(D4_CRIT_VOTES, 1);
});

// --- D4 consensus (critVotes=1) -------------------------------------------

test('aggregateD4: distinct lone criticals are ALL kept at critVotes=1', () => {
  const perReviewer = [
    [{ file: 'a.ts', line: 5, severity: 'critical', summary: 'null deref' }],
    [{ file: 'a.ts', line: 99, severity: 'critical', summary: 'missing await' }],
  ];
  assert.deepEqual(aggregateD4(perReviewer), { critical: 2, important: 0, suggestion: 0 });
});

test('aggregateD4: identical findings from 2 reviewers dedup to 1 (canonical key)', () => {
  const dup = { file: 'a.ts', line: 5, severity: 'critical', summary: 'same exact issue' };
  const perReviewer = [[{ ...dup }], [{ ...dup }]];
  assert.equal(aggregateD4(perReviewer).critical, 1); // deduped
  assert.equal(naiveD4(perReviewer).critical, 2); // naive double-counts — the Gate B divergence
});

test('aggregateD4: same line, DIFFERENT descriptions do NOT dedup', () => {
  const perReviewer = [
    [{ file: 'a.ts', line: 5, severity: 'critical', summary: 'concern A' }],
    [{ file: 'a.ts', line: 5, severity: 'critical', summary: 'concern B' }],
  ];
  assert.equal(aggregateD4(perReviewer).critical, 2); // distinct descriptions survive
});

test('aggregateD4: an UNLOCATABLE critical (no line) demotes to important', () => {
  const perReviewer = [[{ file: 'a.ts', severity: 'critical', summary: 'cannot place' }]];
  assert.deepEqual(aggregateD4(perReviewer), { critical: 0, important: 1, suggestion: 0 });
});

test('naiveD4: flattens every reviewer finding with no consensus, no dedup', () => {
  const perReviewer = [
    [{ file: 'a', line: 1, severity: 'critical', summary: 'x' }, { file: 'a', line: 2, severity: 'important', summary: 'y' }],
    [{ file: 'a', line: 1, severity: 'critical', summary: 'x' }],
  ];
  assert.deepEqual(naiveD4(perReviewer), { critical: 2, important: 1, suggestion: 0 });
});

test('countSeverities tallies tiers', () => {
  assert.deepEqual(
    countSeverities([{ severity: 'critical' }, { severity: 'important' }, { severity: 'important' }, { severity: 'suggestion' }]),
    { critical: 1, important: 2, suggestion: 1 },
  );
});

// --- D2 role-tagging + OD4 synthetic-tsc fallback -------------------------

test('d2Bucket classifies commands', () => {
  assert.equal(d2Bucket('npm run build'), 'build');
  assert.equal(d2Bucket('npx tsc --noEmit'), 'tsc');
  assert.equal(d2Bucket('npm run typecheck'), 'tsc');
  assert.equal(d2Bucket('npm test --silent'), 'test');
  assert.equal(d2Bucket('pytest -x --tb=short'), 'test');
  assert.equal(d2Bucket('npm run lint'), 'other');
});

test('resolveD2Commands: full JS project (test+typecheck+build) → 3 buckets, no synthetic', () => {
  const cmds = resolveD2Commands({
    packageJson: { scripts: { test: 'jest', typecheck: 'tsc --noEmit', build: 'next build' } },
    otherFiles: ['tsconfig.json'],
  });
  const buckets = cmds.map((c) => c.bucket).sort();
  assert.deepEqual(buckets, ['build', 'test', 'tsc']);
  assert.ok(!cmds.some((c) => c.synthetic), 'no synthetic when a real tsc command exists');
});

test('resolveD2Commands: JS project w/ tsconfig but NO typecheck script → synthetic tsc injected (OD4)', () => {
  const cmds = resolveD2Commands({
    packageJson: { scripts: { test: 'jest' } },
    otherFiles: ['tsconfig.json'],
  });
  const tsc = cmds.find((c) => c.bucket === 'tsc');
  assert.ok(tsc, 'tsc bucket present via fallback');
  assert.equal(tsc.cmd, 'npx tsc --noEmit');
  assert.equal(tsc.synthetic, true);
});

test('resolveD2Commands: JS project, NO tsconfig → no synthetic tsc (honest absence)', () => {
  const cmds = resolveD2Commands({
    packageJson: { scripts: { test: 'jest' } },
    otherFiles: [],
  });
  assert.ok(!cmds.some((c) => c.bucket === 'tsc'), 'no tsc gate when there is no tsconfig to type-check against');
});

test('d2SignalsFromResults maps per-bucket failures to scoreD2 signals', () => {
  assert.deepEqual(
    d2SignalsFromResults([
      { bucket: 'build', pass: true },
      { bucket: 'tsc', pass: false },
      { bucket: 'test', pass: true },
    ]),
    { build_fail: 0, tsc_fail: 1, tests_fail: 0 },
  );
  assert.deepEqual(d2SignalsFromResults([]), { build_fail: 0, tsc_fail: 0, tests_fail: 0 });
});
