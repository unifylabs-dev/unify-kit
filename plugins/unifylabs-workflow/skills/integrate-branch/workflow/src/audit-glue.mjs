// audit-glue.mjs — the agent()-backed SOURCE for the integrate-branch Phase-2
// AUDIT Workflow seed (M3 adoption, skill 1 of 3).
//
// THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase / log /
// args). NOT unit-tested (needs the Workflow runtime) — it MUST `node --check`
// clean and avoid wall-clock/random tokens so the determinism guard stays green.
// The pure scoring (compute-audit.mjs) and the agent→reduce bridge
// (audit-aggregate.mjs) ARE unit-tested + verdict-parity-tested; this file only
// gathers the per-dimension SIGNALS and hands them to the authoritative reduce.
//
// DATA-FLOW (master plan §3): the SKILL session resolves the branch + creates a
// detached audit worktree (npm install) and passes its path in as `workingDir`.
// This seed runs a typed parallel() over the 6 weighted dimensions (D4 nests
// parallel(6 pr-review-toolkit reviewers) → consensus; D2 = scout → role-tagged
// resolveVerifier → runner), assembles deterministic signals + override_signals,
// and returns computeAudit()'s {scores, composite, route, ...}. There is NO
// mid-run human gate — the route gate lives back in the SKILL session (a running
// Workflow takes no human input). The bundler appends `return await main(args)`.

import { computeAudit } from '../compute-audit.mjs';
import { aggregateD4, resolveD2Commands, d2SignalsFromResults } from '../audit-aggregate.mjs';

// `meta` MUST be a pure literal, emitted FIRST. No variables / calls / spreads /
// template strings / string concatenation (a `+` is a rejected BinaryExpression).
export const meta = {
  name: 'integrate-audit',
  description:
    'integrate-branch Phase-2 audit: a typed parallel() over the 6 weighted dimensions (D1 CLAUDE.md non-negotiables, D2 test bar via role-tagged resolveVerifier, D3 spec sync, D4 code quality via 6 pr-review-toolkit reviewers + consensus, D5 cross-cutting, D6 visual) reduced by the authoritative compute-audit kernel (composite + D6 renorm + FAIL-CLOSED blocking overrides + route). Returns {scores, composite, route, override, signals} with NO mid-run gate; the salvage/rebuild/discard route gate stays in the SKILL session. JSON args: workingDir (the audit worktree), branch, baseRef (default master), diffRange (default master...HEAD), d6Applicable.',
  phases: [{ title: 'Audit', detail: '6 weighted dimensions in parallel; deterministic reduce' }],
};

// ---------------------------------------------------------------------------
// LEAN schemas (structured-output-pitfall: few flat snake_case fields, no
// hyphenated keys — keeps subagents from skipping StructuredOutput → null).
// ---------------------------------------------------------------------------

const D1_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['critical', 'important'],
  properties: {
    critical: { type: 'integer' },
    important: { type: 'integer' },
    phi_in_logs: { type: 'boolean' },
    secrets: { type: 'boolean' },
    unprotected_public_mutation: { type: 'boolean' },
  },
};

const PROJECT_FILES_SCHEMA = {
  type: 'object',
  properties: {
    packageJson: { type: 'string' },
    pyprojectToml: { type: 'string' },
    makefile: { type: 'string' },
    lockfiles: { type: 'array', items: { type: 'string' } },
    otherFiles: { type: 'array', items: { type: 'string' } },
  },
};

// One runner schema for every D2 command. `majority_fail` is meaningful only for
// the test bucket (>50% of tests failing); `fixable` only for the build bucket
// (an obvious fix path exists). Defaults keep non-applicable fields inert.
const RUNNER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail', 'fail-permanent'] },
    majority_fail: { type: 'boolean' },
    fixable: { type: 'boolean' },
  },
};

const COVERAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['untested_new'],
  properties: { untested_new: { type: 'integer' } },
};

const D3_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['drift', 'missing_update'],
  properties: { drift: { type: 'integer' }, missing_update: { type: 'integer' } },
};

// D4 reviewer findings — the shape consensusAggregate/canonical consume (line is
// FIRST-CLASS: an unlocatable critical auto-demotes, so the reviewers must place).
const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'severity', 'summary'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
          summary: { type: 'string' },
        },
      },
    },
  },
};

const D5_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['foundational', 'shared', 'adjacent_drift', 'migration_conflict'],
  properties: {
    foundational: { type: 'integer' },
    shared: { type: 'integer' },
    adjacent_drift: { type: 'integer' },
    migration_conflict: { type: 'integer' }, // 0|1 — feeds scoreD5 (−40) AND the rebuild override
    foundational_auth_broken: { type: 'boolean' }, // dal.ts/auth.ts/middleware.ts weakened → discard
  },
};

const D6_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['applicable', 'drift'],
  properties: { applicable: { type: 'boolean' }, drift: { type: 'integer' } },
};

// The 6 named pr-review-toolkit reviewer lenses for D4 (resolution + line-bearing
// findings PROVEN live, probe wf_8bf0957a-0cc).
const D4_REVIEWERS = [
  'pr-review-toolkit:code-reviewer',
  'pr-review-toolkit:silent-failure-hunter',
  'pr-review-toolkit:type-design-analyzer',
  'pr-review-toolkit:comment-analyzer',
  'pr-review-toolkit:code-simplifier',
  'pr-review-toolkit:pr-test-analyzer',
];

// ---------------------------------------------------------------------------
// Prompt builders.
// ---------------------------------------------------------------------------

function diffIntro(workingDir, diffRange, branch) {
  return [
    `Audit the external branch "${branch}" (read-only) in the working directory: ${workingDir}.`,
    `The change under review is the diff: git diff ${diffRange}  (run it + its --name-only / --stat as needed).`,
    'Read every modified/added file from the branch — config, styles, tests, migrations all carry signal. Do NOT modify anything.',
  ].join('\n');
}

function d1Prompt(workingDir, diffRange, branch) {
  return [
    diffIntro(workingDir, diffRange, branch),
    '',
    'DIMENSION 1 — CLAUDE.md non-negotiables. For every modified/added Server Action (src/app/.../actions.ts, src/lib/actions/**):',
    '- Auth guard (verifySession/verifyRole) on mutations — Critical if missing.',
    '- Audit logging (logAudit) on mutations — Critical if missing.',
    '- Server Action contract ({error}/{fieldErrors}; re-throw NEXT_REDIRECT) — Important if raw throws.',
    '- Zod validation on input — Important if missing.',
    '- Rate limiting on public endpoints (/api/public/*,/f/*,/intake/*,/book/*,/my/*) — Critical if missing.',
    '- Timing-safe auth responses on login/magic-link/reset — Critical if missing.',
    '- Cron secret (verifyCronSecret) under api/cron/** — Critical if missing.',
    '',
    'Return `critical` and `important` COUNTS. Also return the FAIL-CLOSED override booleans (default false; set true ONLY if observed):',
    '- phi_in_logs: a console.log/console.error includes a template literal with patient fields (name,email,phone,dob,healthCard,prescription) — PHIPA violation.',
    '- secrets: a hard-coded credential/API key/token is committed in the diff.',
    '- unprotected_public_mutation: a mutating action on a public route with no auth/rate-limit guard.',
  ].join('\n');
}

function scoutPrompt(workingDir) {
  return [
    `Inspect the project's build/test config in: ${workingDir}. Do NOT run anything; only read files that exist.`,
    'Return raw text for present files: packageJson (package.json), pyprojectToml, makefile;',
    'lockfiles: present names among pnpm-lock.yaml, yarn.lock, bun.lockb, bun.lock, package-lock.json;',
    "otherFiles: present names among Cargo.toml, go.mod, requirements.txt, Gemfile, setup.cfg, tsconfig.json, and the dir markers 'tests/' and 'spec/'.",
    'Omit any field whose file is absent.',
  ].join('\n');
}

function runnerPrompt(cmd, bucket, workingDir) {
  return [
    `Run this verifier command in ${workingDir}: ${cmd}`,
    "verdict='pass' if it exits 0; 'fail' if it exits non-zero (a real test/check failure); 'fail-permanent' if the command itself is missing/unrunnable.",
    bucket === 'test'
      ? 'Also set majority_fail=true if MORE THAN HALF of the tests failed (catastrophic), else false.'
      : 'Set majority_fail=false.',
    bucket === 'build'
      ? 'Also set fixable=true if any build failure looks like an obvious quick fix, false if it is a deep/structural failure with no obvious fix path.'
      : 'Set fixable=true.',
  ].join('\n');
}

function coveragePrompt(workingDir, diffRange) {
  return [
    `In ${workingDir}, count NEW source files added by the branch that LACK a sibling test.`,
    `Added files: git diff ${diffRange} --name-only --diff-filter=A | grep -E '^src/.+\\.(ts|tsx)$' | grep -v test`,
    'For each, check for a sibling .test.ts/.test.tsx. Return untested_new = the count with NO sibling test.',
  ].join('\n');
}

function d3Prompt(workingDir, diffRange, branch) {
  return [
    diffIntro(workingDir, diffRange, branch),
    '',
    'DIMENSION 3 — Spec sync. For each modified file under spec-covered code (docs/specs/modules/*.md, docs/specs/journeys/*.md):',
    '- drift: behavior in a modified file diverges from a documented invariant in its module spec (count each).',
    '- missing_update: the branch touches spec-covered code but the diff has ZERO docs/specs/*.md changes (count each covered module untouched in specs).',
    'Return the two COUNTS.',
  ].join('\n');
}

function d4ReviewerPrompt(workingDir, diffRange, branch, agentType) {
  return [
    `You are an ADVERSARIAL code reviewer (${agentType}) auditing external branch "${branch}", REPORT-ONLY.`,
    `Review the diff: git diff ${diffRange}  (working directory: ${workingDir}). Do NOT apply fixes.`,
    'Report only genuine defects this change INTRODUCES, each tiered critical | important | suggestion.',
    "Cite each finding's file (from the hunk's +++ b/<file> header) and the INTEGER line of the relevant + line. `line` is REQUIRED — an unlocatable critical is demoted.",
    'Return findings per the schema; empty array if your lens finds nothing meeting its bar.',
  ].join('\n');
}

function d5Prompt(workingDir, diffRange, branch) {
  return [
    diffIntro(workingDir, diffRange, branch),
    '',
    'DIMENSION 5 — Cross-cutting impact. LIST-ONLY (do NOT run dependent tests). For every modified shared resource (src/lib/*, src/components/*, prisma models, shared types), count dependents:',
    '- foundational: modified shared resources with >10 dependents (count).',
    '- shared: modified shared resources with 1-10 dependents (count).',
    '- adjacent_drift: module specs NOT directly modified that reference symbols this branch DOES modify (count).',
    '- migration_conflict: 1 if a prisma migration name collides with a master migration not on the branch (out-of-order), else 0.',
    'Also FAIL-CLOSED: foundational_auth_broken = true if the branch modifies src/lib/dal.ts, src/lib/auth.ts, or middleware.ts in a way that REMOVES or WEAKENS an existing check (→ Discard), else false.',
    'Return all counts + the booleans.',
  ].join('\n');
}

function d6Prompt(workingDir, diffRange, branch, hint) {
  return [
    diffIntro(workingDir, diffRange, branch),
    '',
    'DIMENSION 6 — Visual fidelity (conditional, weight 5%).',
    `applicable = true ONLY if the branch modifies .tsx under src/app/** or src/components/** AND a visual ground truth exists (PR screenshots or a prototype style source). ${hint ? 'Caller hint: ' + hint : ''}`,
    'If applicable, compare each modified UI file\'s Tailwind classes against the ground truth and count drift. If not applicable, return applicable=false, drift=0 (the reduce renormalizes the remaining weights ÷0.95).',
    'Return { applicable, drift }.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Dimension thunks (the only agent()/parallel()-calling code). Each returns the
// dimension's signal object, or null when the agent skipped StructuredOutput.
// ---------------------------------------------------------------------------

async function auditD1(ctx) {
  return agent(d1Prompt(ctx.workingDir, ctx.diffRange, ctx.branch), { label: 'D1:non-negotiables', phase: 'Audit', schema: D1_SCHEMA });
}

async function auditD2(ctx) {
  const projectFiles = await agent(scoutPrompt(ctx.workingDir), { label: 'D2:scout', phase: 'Audit', schema: PROJECT_FILES_SCHEMA });
  const cmds = resolveD2Commands(projectFiles ?? {});
  const results = [];
  let majority_fail = false;
  let build_unfixable = false;
  for (const { cmd, bucket } of cmds) {
    const res = await agent(runnerPrompt(cmd, bucket, ctx.workingDir), { label: `D2:run ${bucket}`, phase: 'Audit', schema: RUNNER_SCHEMA });
    const pass = !!res && res.verdict === 'pass';
    results.push({ bucket, pass });
    if (res && bucket === 'test' && res.majority_fail === true) majority_fail = true;
    if (res && bucket === 'build' && res.verdict !== 'pass' && res.fixable === false) build_unfixable = true;
  }
  const coverage = await agent(coveragePrompt(ctx.workingDir, ctx.diffRange), { label: 'D2:coverage', phase: 'Audit', schema: COVERAGE_SCHEMA });
  const sig = d2SignalsFromResults(results);
  return {
    ...sig,
    untested_new: coverage && Number.isFinite(coverage.untested_new) ? coverage.untested_new : 0,
    tests_majority_fail: majority_fail,
    build_fails_no_fix: build_unfixable,
  };
}

async function auditD3(ctx) {
  return agent(d3Prompt(ctx.workingDir, ctx.diffRange, ctx.branch), { label: 'D3:spec-sync', phase: 'Audit', schema: D3_SCHEMA });
}

async function auditD4(ctx) {
  const outputs = await parallel(
    D4_REVIEWERS.map((agentType) => () =>
      agent(d4ReviewerPrompt(ctx.workingDir, ctx.diffRange, ctx.branch, agentType), {
        label: `D4:${agentType.split(':')[1]}`,
        phase: 'Audit',
        agentType,
        schema: FINDINGS_SCHEMA,
      }),
    ),
  );
  const perReviewer = outputs.map((o) => (o && Array.isArray(o.findings) ? o.findings : []));
  return aggregateD4(perReviewer); // { critical, important, suggestion } — critVotes=1 dedup-only
}

async function auditD5(ctx) {
  return agent(d5Prompt(ctx.workingDir, ctx.diffRange, ctx.branch), { label: 'D5:cross-cutting', phase: 'Audit', schema: D5_SCHEMA });
}

async function auditD6(ctx) {
  return agent(d6Prompt(ctx.workingDir, ctx.diffRange, ctx.branch, ctx.d6Hint), { label: 'D6:visual', phase: 'Audit', schema: D6_SCHEMA });
}

// ---------------------------------------------------------------------------
// Entrypoint.
// ---------------------------------------------------------------------------

function parseArgs(rawArgs) {
  if (rawArgs == null) return {};
  if (typeof rawArgs === 'object') return rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      return JSON.parse(rawArgs);
    } catch {
      return {};
    }
  }
  return {};
}

export async function main(rawArgs) {
  const input = parseArgs(rawArgs);
  const workingDir = input.workingDir || '.';
  const branch = input.branch || '(branch)';
  const baseRef = input.baseRef || 'master';
  const diffRange = input.diffRange || `${baseRef}...HEAD`;
  const ctx = { workingDir, branch, baseRef, diffRange, d6Hint: input.d6Hint };

  log(`integrate-audit: branch=${branch} workingDir=${workingDir} diffRange=${diffRange}`);

  // The 6 weighted dimensions, in parallel (D4 itself fans out 6 reviewers).
  const [d1, d2, d3, d4, d5, d6] = await parallel([
    () => auditD1(ctx),
    () => auditD2(ctx),
    () => auditD3(ctx),
    () => auditD4(ctx),
    () => auditD5(ctx),
    () => auditD6(ctx),
  ]);

  // FAIL-CLOSED degradation: a null from an override-CARRYING dimension (D1/D2/D5)
  // means a deterministic signal could not be read. We never silently treat it as
  // a clean pass — a degraded audit may not auto-recommend Salvage (downgraded to
  // user-decides below), and the dimension scores worst-case (0).
  const degraded_dims = [];
  if (!d1) degraded_dims.push('D1');
  if (!d2) degraded_dims.push('D2');
  if (!d5) degraded_dims.push('D5');
  const degraded = degraded_dims.length > 0;

  const override_signals = {
    phi_in_logs: d1 ? d1.phi_in_logs === true : true, // degraded D1 ⇒ potentially-firing
    secrets: d1 ? d1.secrets === true : true,
    unprotected_public_mutation: d1 ? d1.unprotected_public_mutation === true : true,
    tests_majority_fail: d2 ? d2.tests_majority_fail === true : false,
    build_fails_no_fix: d2 ? d2.build_fails_no_fix === true : false,
    migration_conflict: d5 ? Number(d5.migration_conflict) === 1 : false,
    foundational_auth_broken: d5 ? d5.foundational_auth_broken === true : true,
  };

  const signals = {
    d1: d1 ? { critical: d1.critical, important: d1.important } : { critical: 5, important: 0 },
    d2: d2
      ? { build_fail: d2.build_fail, tsc_fail: d2.tsc_fail, tests_fail: d2.tests_fail, untested_new: d2.untested_new }
      : { build_fail: 1, tsc_fail: 1, tests_fail: 1, untested_new: 0 },
    d3: d3 ? { drift: d3.drift, missing_update: d3.missing_update } : { drift: 5, missing_update: 0 },
    d4: d4 ? { critical: d4.critical, important: d4.important } : { critical: 10, important: 0 },
    d5: d5
      ? { foundational: d5.foundational, shared: d5.shared, adjacent_drift: d5.adjacent_drift, migration_conflict: Number(d5.migration_conflict) || 0 }
      : { foundational: 10, shared: 0, adjacent_drift: 0, migration_conflict: 0 },
    d6: d6 ? { applicable: d6.applicable === true, drift: d6.drift } : { applicable: false, drift: 0 },
    override_signals,
  };

  const audit = computeAudit(signals);

  // Degraded audits never auto-recommend Salvage on incomplete signals.
  let route = audit.route;
  let route_basis = audit.route_basis;
  if (degraded && route === 'salvage') {
    route = 'user-decides';
    route_basis = 'degraded-downgrade';
    log(`integrate-audit: DEGRADED (${degraded_dims.join(',')}) — Salvage downgraded to user-decides`);
  }

  log(`integrate-audit: composite=${audit.composite_display}/100 route=${route} basis=${route_basis} override=${audit.override.route ?? 'none'}`);

  return {
    branch,
    scores: audit.scores,
    composite: audit.composite,
    composite_display: audit.composite_display,
    route,
    route_basis,
    override: audit.override,
    degraded,
    degraded_dims,
    signals,
  };
}
