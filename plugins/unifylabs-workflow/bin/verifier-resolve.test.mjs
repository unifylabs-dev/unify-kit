// verifier-resolve.test.mjs — node:test for the on-disk resolver shim.
//
// Exercises the shim END TO END against real temp directories (it reads files
// off disk), proving the disk->projectFiles->resolveVerifier wiring:
//   - a JS project (package.json with a `test` script + a lockfile) resolves to
//     the runner-prefixed npm test command list.
//   - a docs-only / empty tree resolves to [] (the unify-kit live no-op case).
//
// Run as a child process (the shim is a CLI that prints JSON to stdout) so the
// test also covers argv handling + the {"commands":[...]} envelope.
//
// Zero-dep: node:test + node:assert + node:fs/os/path/child_process only. NO
// wall-clock, NO random (scanned by the determinism guard).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SHIM = fileURLToPath(new URL('./verifier-resolve.mjs', import.meta.url));

/** Run the shim against a dir, parse its JSON stdout. */
function runShim(dir) {
  const out = execFileSync(process.execPath, [SHIM, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('green JS project (package.json test script + lockfile) -> npm test list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backstop-resolve-green-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'node --test', lint: 'eslint .' } }),
    );
    writeFileSync(join(dir, 'package-lock.json'), '{}'); // npm runner
    const { commands } = runShim(dir);
    assert.ok(Array.isArray(commands), 'commands is an array');
    assert.deepEqual(commands, ['npm test --silent', 'npm run lint']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green JS project honors lockfile runner precedence (pnpm)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backstop-resolve-pnpm-'));
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { test: 'vitest' } }),
    );
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
    const { commands } = runShim(dir);
    assert.deepEqual(commands, ['pnpm test --silent']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('empty / docs-only tree -> [] (the unify-kit live no-op case)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backstop-resolve-empty-'));
  try {
    writeFileSync(join(dir, 'README.md'), '# docs only\n');
    const { commands } = runShim(dir);
    assert.deepEqual(commands, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-directory argument exits non-zero (caller fails open)', () => {
  let threw = false;
  try {
    execFileSync(process.execPath, [SHIM, join(tmpdir(), 'definitely-not-a-real-dir-xyz')], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (e) {
    threw = true;
    assert.notEqual(e.status, 0);
  }
  assert.ok(threw, 'shim should exit non-zero for a missing working dir');
});
