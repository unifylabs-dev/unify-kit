// stopping-engine.test.mjs — the enforced-loop CI gate (M1 P1/P2).
//
// This harness READS evals/loop-control-evals.json and GENERATES one node:test
// per scenario, building deterministic stubs from each scenario's data. The
// eval-JSON is the SINGLE SOURCE OF TRUTH; the harness parses it so the JSON and
// the assertions cannot silently drift. PLUS a determinism + frozen-vocabulary
// guard test that source-scans the engine + lib + fixtures + this harness for
// any forbidden wall-clock/random call.
//
// Zero-dependency: node:test + node:assert only. No package.json, no
// node_modules — matches the kit's no-toolchain ethos (ADR: Node stack
// expansion). NO Date/now, NO Math.random anywhere in here either.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { runLoopUntilDry } from '../stopping-engine.mjs';
import {
  EXIT_REASONS,
  EXIT_REASON_VALUES,
  assertExitReason,
} from '../lib/exit-reasons.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_DIR = resolve(__dirname, '..');
const EVALS_PATH = join(WORKFLOW_DIR, 'evals', 'loop-control-evals.json');

// ---------------------------------------------------------------------------
// Deterministic stub builder — turns one scenario into the injected callbacks
// + budget object the engine consumes.
// ---------------------------------------------------------------------------

function buildStubs(scenario) {
  const cfg = scenario.config ?? {};
  const rounds = scenario.rounds ?? [];

  // Mutable, DETERMINISTIC spend counter. No wall-clock, no random.
  let spent = Number(cfg.initialSpend ?? 0);
  const total = cfg.budgetTotal === undefined ? null : cfg.budgetTotal;

  const budget = {
    spent: () => spent,
    remaining: () => (total === null ? Infinity : total - spent),
    total,
  };

  // Per-round accrual happens once, at the FIRST callback invoked in a round
  // (applyFixes if there is work, else verify). The engine's top-of-round
  // budget check runs BEFORE any callback, so it sees spend through the prior
  // round — exactly the harness-contract in the eval JSON.
  let accruedForRound = 0; // highest round index already accrued (1-indexed)

  function accrue(round) {
    if (round > accruedForRound) {
      const r = rounds[round - 1];
      if (r && typeof r.spend === 'number') spent += r.spend;
      accruedForRound = round;
    }
  }

  let reviewRoundCalls = 0;
  let applyFixesCalls = 0;

  async function applyFixes({ round }) {
    accrue(round);
    applyFixesCalls += 1;
  }

  async function verify({ round }) {
    accrue(round);
    const r = rounds[round - 1];
    return (r && r.verify) || 'pass';
  }

  async function reviewRound({ round }) {
    accrue(round);
    reviewRoundCalls += 1;
    const r = rounds[round - 1];
    return (r && r.reviewReturns) || [];
  }

  return {
    budget,
    applyFixes,
    verify,
    reviewRound,
    counters: {
      get reviewRoundCalls() {
        return reviewRoundCalls;
      },
      get applyFixesCalls() {
        return applyFixesCalls;
      },
    },
  };
}

function loadEvals() {
  const raw = readFileSync(EVALS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.scenarios), 'evals.scenarios must be an array');
  assert.ok(
    parsed.scenarios.length > 0,
    'evals must define at least one scenario',
  );
  return parsed;
}

// ---------------------------------------------------------------------------
// Generate one test per scenario.
// ---------------------------------------------------------------------------

const evals = loadEvals();

for (const scenario of evals.scenarios) {
  test(`scenario: ${scenario.id} — ${scenario.description}`, async () => {
    const cfg = scenario.config ?? {};
    const stubs = buildStubs(scenario);

    const result = await runLoopUntilDry({
      initialFindings: scenario.initialFindings ?? [],
      reviewRound: stubs.reviewRound,
      applyFixes: stubs.applyFixes,
      verify: stubs.verify,
      budget: stubs.budget,
      cap: cfg.cap,
      fixedPointK: cfg.fixedPointK,
      skipClean: cfg.skipClean,
      includeSuggestions: cfg.includeSuggestions,
      gateImportant: cfg.gateImportant,
      relativeMultiplier: cfg.relativeMultiplier,
      absoluteThreshold: cfg.absoluteThreshold,
      workingDir: '/tmp/eval',
      runSeed: 0,
    });

    const exp = scenario.expect;

    // --- exit reason must be in the frozen vocabulary AND match -----------
    assert.ok(
      EXIT_REASON_VALUES.has(result.exitReason),
      `${scenario.id}: exitReason "${result.exitReason}" not in frozen vocabulary`,
    );
    assert.equal(
      result.exitReason,
      exp.exitReason,
      `${scenario.id}: exitReason mismatch`,
    );

    // --- rounds + residual counts -----------------------------------------
    assert.equal(
      result.roundsRun,
      exp.roundsRun,
      `${scenario.id}: roundsRun mismatch`,
    );
    assert.equal(
      result.residualCritical,
      exp.residualCritical,
      `${scenario.id}: residualCritical mismatch`,
    );
    assert.equal(
      result.residualImportant,
      exp.residualImportant,
      `${scenario.id}: residualImportant mismatch`,
    );

    // --- frozen return shape ----------------------------------------------
    assert.ok(Object.isFrozen(result), `${scenario.id}: return not frozen`);
    assert.ok(
      Object.isFrozen(result.truncationLog),
      `${scenario.id}: truncationLog not frozen`,
    );
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'budgetSpent',
        'exitReason',
        'residualCritical',
        'residualImportant',
        'resolved',
        'roundsRun',
        'truncationLog',
      ],
      `${scenario.id}: return keys mismatch`,
    );
    assert.equal(
      typeof result.budgetSpent,
      'number',
      `${scenario.id}: budgetSpent not a number`,
    );
    assert.equal(
      typeof result.resolved,
      'number',
      `${scenario.id}: resolved not a number`,
    );

    // --- truncationLog substring assertion (a silent stop is impossible) ---
    if (scenario.expectTruncationContains) {
      const joined = result.truncationLog.join('\n');
      assert.ok(
        joined.includes(scenario.expectTruncationContains),
        `${scenario.id}: truncationLog missing "${scenario.expectTruncationContains}"\n` +
          `got: ${JSON.stringify(result.truncationLog)}`,
      );
    }

    // --- reviewRound call-count assertion (skip-if-clean never calls it) ---
    if (typeof scenario.expectReviewRoundCalls === 'number') {
      assert.equal(
        stubs.counters.reviewRoundCalls,
        scenario.expectReviewRoundCalls,
        `${scenario.id}: reviewRound call count mismatch`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Determinism + frozen-vocabulary guard test.
// ---------------------------------------------------------------------------

test('guard: engine + lib + fixtures + harness are free of wall-clock / random calls', () => {
  // Files that MUST be deterministic. We scan source text for forbidden tokens.
  // RECURSE every .mjs under the workflow dir (engine root, lib/, test/, and any
  // future subdir) so a non-deterministic call cannot hide in a nested module.
  const targets = [];

  function collectMjs(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        // Skip dot-dirs (e.g. .git, node-style caches) — never source we own.
        if (ent.name.startsWith('.')) continue;
        collectMjs(full);
      } else if (ent.isFile() && ent.name.endsWith('.mjs')) {
        targets.push(full);
      }
    }
  }
  collectMjs(WORKFLOW_DIR);

  // fixtures: the eval JSON is the engine's fixture set (not a .mjs, so add it
  // explicitly).
  targets.push(EVALS_PATH);

  // Forbidden wall-clock / random patterns. We intentionally allow the harness
  // to reference them ONLY inside this guard's own pattern list — so the strings
  // below are written SPLIT (string concatenation) so they don't match
  // themselves when this very file is scanned by the recursive walk above.
  const forbidden = [
    'Date' + '.now(',
    'new ' + 'Date(',
    'Date' + '.parse(',
    'Math' + '.random(',
    'crypto' + '.randomUUID(',
    'crypto' + '.getRandomValues(',
    'set' + 'Timeout(',
    'set' + 'Interval(',
    'process' + '.hrtime(',
    'performance' + '.now(',
  ];

  for (const file of targets) {
    const src = readFileSync(file, 'utf8');
    for (const pat of forbidden) {
      assert.ok(
        !src.includes(pat),
        `forbidden non-deterministic call "${pat}" found in ${file}`,
      );
    }
  }
});

test('guard: exit-reasons vocabulary is frozen and rejects illegal reasons', () => {
  // Frozen object.
  assert.ok(Object.isFrozen(EXIT_REASONS), 'EXIT_REASONS not frozen');
  assert.ok(Object.isFrozen(EXIT_REASON_VALUES), 'EXIT_REASON_VALUES not frozen');

  // Exactly the seven legal reasons, no more, no less.
  assert.deepEqual(
    Array.from(EXIT_REASON_VALUES).sort(),
    [
      'aborted',
      'cap',
      'circuit-breaker',
      'clean',
      'criticals-pending-gate',
      'fixed-point',
      'skip-if-clean',
    ],
    'frozen vocabulary drifted',
  );

  // Guard throws on a bad reason.
  assert.throws(
    () => assertExitReason('not-a-real-reason'),
    /illegal exitReason/,
    'assertExitReason must throw on an illegal reason',
  );
  assert.throws(
    () => assertExitReason(undefined),
    /illegal exitReason/,
    'assertExitReason must throw on undefined',
  );

  // Guard passes every legal reason.
  for (const r of EXIT_REASON_VALUES) {
    assert.equal(assertExitReason(r), r);
  }
});
