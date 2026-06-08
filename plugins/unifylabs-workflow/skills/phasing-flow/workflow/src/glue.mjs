// glue.mjs — the agent()-backed SOURCE for the phasing-flow execution Workflow
// (M2 D1, the flagship engine seed).
//
// THIS IS THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase /
// log / args / budget). It is NOT unit-tested (it needs the Workflow runtime),
// but it MUST `node --check` clean and MUST avoid the forbidden wall-clock/random
// tokens so the recursive determinism guard stays green.
//
// REAL Workflow API (ADR 0003, proven on iterative-review + planning-brain):
//   - agent(promptString, { agentType, schema, label, phase }) -> sub-agent;
//     with `schema` returns the validated object (null if it never called
//     StructuredOutput), without it returns text.
//   - parallel(thunks)  -> NATIVE bounded fan-out (the runtime owns the pool).
//   - phase(title)       -> a progress group; assigned per-agent via the `phase`
//                           OPTION (phase() is a void marker, NOT phase(name,fn)).
//   - log(msg)           -> structured run log.
//   - args               -> the Workflow input; arrives as a JSON STRING (parse it).
//   - budget             -> { spent(), remaining(), total }.
//
// The deterministic bundler (build-workflow.mjs) inlines the tested kernel
// (lib/*.mjs + unit-cursor.mjs + verify-verdict.mjs + execution-engine.mjs +
// wrapper.mjs) AHEAD of this body, strips the imports below, and appends a
// top-level `return await main(args)` — the runtime runs the script BODY and the
// top-level return is the workflow result.
//
// THE LOOP (single-unit serial for M2; the kernel supports N): for each approved
// unit -> EXECUTE (an agent does the unit's work + captures its git diff) ->
// VERIFY (the deterministic scout->resolveVerifier->runner chain, AUTHORITATIVE)
// -> DIFF-REVIEW (>=2 adversarial reviewers, consensus >=2 to RAISE a gate,
// fail-open). A RED verify or a consensus-Critical diff hands off to the
// between-runs human gate (criticals-pending-gate).

import { runPhasingFlowExecution } from '../wrapper.mjs';
import { resolveVerifier } from '../lib/verifier-detect.mjs';
import { consensusAggregate } from '../lib/consensus-aggregate.mjs';

// `meta` MUST be a pure literal and is emitted FIRST in the bundle — the Workflow
// tool reads { name, description, phases } before executing the body. No
// variables / calls / spreads / template strings / string CONCATENATION (a `+`
// is a rejected BinaryExpression).
export const meta = {
  name: 'phasing-flow-engine',
  description:
    'Phasing-flow execution engine: runs an approved units[] plan serially as execute -> deterministic verify (authoritative) -> adversarial diff-review (consensus >=2, fail-open), looping until a provable ceiling fires (clean / criticals-pending-gate / aborted / cap / circuit-breaker / fixed-point / skip-if-clean) over the tested execution-engine kernel. JSON args: units (required array of {id,title,instruction,verify_hint?}), workingDir, cap, diffReviewers (default 2).',
  phases: [
    { title: 'Execute', detail: 'run each approved unit; capture its git diff' },
    { title: 'Verify', detail: 'resolve + run the project verifier (authoritative)' },
    { title: 'Diff-review', detail: 'adversarial reviewers; consensus >=2 to raise a gate' },
  ],
};

// ---------------------------------------------------------------------------
// LEAN schemas (structured-output-pitfall: few flat fields, snake_case only, no
// hyphenated keys — keeps subagents from skipping StructuredOutput + returning
// null). Heavy content (the diff body) goes to DISK; the manifest stays lean.
// ---------------------------------------------------------------------------

// executeUnit output: a LEAN manifest. The heavy diff body is written to
// `diff_path`; the structured payload carries only the manifest. `error` is set
// (and the agent returns it) when the unit could not be completed — the kernel
// classifies a missing/error manifest as 'aborted'.
const MANIFEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'diff_path'],
  properties: {
    summary: { type: 'string' },
    diff_path: { type: 'string' },
    changed_files: { type: 'array', items: { type: 'string' } },
    error: { type: 'string' },
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

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['pass', 'fail', 'fail-permanent'] } },
  required: ['verdict'],
};

// diff-reviewer output: LEAN findings (same shape consensusAggregate consumes —
// severity already resolved to critical|important|suggestion).
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
          summary: { type: 'string' },
        },
        required: ['file', 'severity'],
      },
    },
  },
  required: ['findings'],
};

// The two adversarial diff-review lenses (>=2 so consensus >=2 is MEANINGFUL — a
// lone Critical from one lens is demoted to Important by consensusAggregate and
// does not block; only a Critical BOTH lenses raise within +/-3 lines blocks).
const DIFF_REVIEW_LENSES = [
  'runtime-safety + correctness: bugs this diff INTRODUCES (null/undefined deref, logic errors, broken async/await, off-by-one, a change that breaks existing behavior)',
  'security + contract: secrets/credentials added, injection or unsafe-exec introduced, a violated invariant or broken public contract, missing validation on a new input path',
];

// ---------------------------------------------------------------------------
// Prompt builders (generic — no benchmark-specific text).
// ---------------------------------------------------------------------------

function executePrompt(unit, workingDir, diffPath) {
  const instruction = (unit && unit.instruction) || (unit && unit.title) || '(no instruction)';
  const title = (unit && unit.title) || (unit && unit.id) || '(unit)';
  return [
    `You are executing ONE unit of an ALREADY-APPROVED plan, in the working directory: ${workingDir}.`,
    `UNIT: ${title}`,
    `INSTRUCTION (do EXACTLY this — no more, no less):`,
    instruction,
    '',
    'Constraints: implement ONLY this unit. Do NOT do work belonging to other units; do NOT refactor',
    'unrelated code. Follow the repository conventions you can see in surrounding files.',
    '',
    `After editing, capture the COMPLETE change as a unified diff and write it to: ${diffPath}`,
    `Use the project's VCS — e.g. run: mkdir -p "$(dirname ${diffPath})" && git add -A && git diff --cached > ${diffPath}`,
    '(staging first so NEW files appear in the diff). Do NOT commit.',
    '',
    'Return a LEAN manifest per the schema: a one-to-two sentence `summary`, the `diff_path` you wrote,',
    'and `changed_files` (the paths you changed). If you CANNOT complete the unit — the instruction is',
    'impossible, or a write is blocked — set `error` to a short reason instead of fabricating a diff.',
  ].join('\n');
}

function scoutPrompt(workingDir) {
  return [
    `Inspect the project's build/test configuration in: ${workingDir}. Do NOT run anything; only read files that exist.`,
    'Return, for files that exist:',
    '- packageJson: the raw text of package.json (if present)',
    '- pyprojectToml: the raw text of pyproject.toml (if present)',
    '- makefile: the raw text of Makefile (if present)',
    '- lockfiles: filenames present among pnpm-lock.yaml, yarn.lock, bun.lockb, bun.lock, package-lock.json',
    "- otherFiles: present names among Cargo.toml, go.mod, requirements.txt, Gemfile, setup.cfg, and the directory markers 'tests/' and 'spec/'",
    'Omit any field whose file is absent.',
  ].join('\n');
}

function runnerPrompt(cmd, workingDir) {
  return [
    `Run this verifier command in ${workingDir}: ${cmd}`,
    "Return verdict='pass' if it exits 0; verdict='fail' if it exits non-zero (test/check failure); verdict='fail-permanent' if the command itself is missing or cannot be run at all (not a test failure).",
  ].join('\n');
}

function diffReviewPrompt(diffPath, unit, workingDir, lens, idx, n) {
  const title = (unit && unit.title) || (unit && unit.id) || '(unit)';
  return [
    `You are ADVERSARIAL diff-reviewer ${idx} of ${n} over a code change. Be skeptical; report only genuine defects this change INTRODUCES.`,
    `Read the unified diff at: ${diffPath} (working directory: ${workingDir}). It is the change produced by the unit "${title}".`,
    `Apply your lens: ${lens}.`,
    '',
    'Severity policy (assign each finding a tier):',
    '- critical: you are highly confident the change introduces a runtime-breaking / data-or-security-corrupting defect or a clear contract violation. Reserve for genuinely blocking defects; do NOT over-escalate nits.',
    '- important: a real edge-case / robustness / missing-validation gap.',
    '- suggestion: style / clarity / naming.',
    '',
    "Cite each finding as <file>:<line>, where <file> is the source file from that hunk's `+++ b/<file>` header and <line> is the displayed line of the relevant `+` line.",
    'Return findings per the schema. If your lens finds nothing meeting the bar, return an empty findings array. Do NOT modify anything.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Effectful steps (the only agent()/parallel()-calling code).
// ---------------------------------------------------------------------------

/** Slash-trim a dir so `${dir}/.phasing-flow-run/...` never doubles a slash. */
function trimDir(dir) {
  const d = typeof dir === 'string' && dir.length > 0 ? dir : '.';
  return d.endsWith('/') ? d.slice(0, -1) : d;
}

/**
 * EXECUTE — dispatch ONE executor agent that performs the unit's work and writes
 * its git diff to disk. Returns a lean manifest, or null when the agent never
 * called StructuredOutput (failed / hook-blocked) — the kernel classifies a
 * missing/error manifest as 'aborted'.
 */
async function executeUnit({ unit, unitNum, workingDir }) {
  const wd = workingDir || '.';
  const diffPath = `${trimDir(workingDir)}/.phasing-flow-run/unit-${unitNum}.diff`;
  const manifest = await agent(executePrompt(unit, wd, diffPath), {
    label: `execute:unit-${unitNum}`,
    phase: 'Execute',
    schema: MANIFEST_SCHEMA,
  });
  if (!manifest) return null;
  // Prefer the agent's reported diff_path; fall back to the path we instructed.
  return { ...manifest, diff_path: manifest.diff_path || diffPath };
}

/**
 * VERIFY (deterministic, AUTHORITATIVE) — a scout reads the project files (pure
 * i/o), resolveVerifier (tested) turns them into the command list, then a runner
 * runs each and reports a verdict. Returns 'pass' | 'fail' | 'fail-permanent'.
 * Lifted from the iterative-review verify path.
 */
async function runVerify({ workingDir }) {
  const projectFiles = await agent(scoutPrompt(workingDir || '.'), {
    label: 'verify-scout',
    phase: 'Verify',
    schema: PROJECT_FILES_SCHEMA,
  });
  const commands = resolveVerifier(projectFiles ?? {});
  if (commands.length === 0) {
    log('verify: no verifier command resolved — treating as pass');
    return 'pass';
  }
  for (const cmd of commands) {
    const res = await agent(runnerPrompt(cmd, workingDir || '.'), {
      label: 'verify-run',
      phase: 'Verify',
      schema: VERDICT_SCHEMA,
    });
    const verdict = res && res.verdict;
    if (verdict === 'fail-permanent') return 'fail-permanent';
    if (verdict === 'fail') return 'fail';
  }
  return 'pass';
}

/**
 * DIFF-REVIEW (adversarial, fail-open, can only RAISE) — fan out N (>=2) reviewer
 * agents over the unit's diff via NATIVE parallel(), consensus-aggregate their
 * findings (ADR 0002: a Critical survives only if >=2 reviewers raise it within
 * +/-3 lines), and return the consensus-Critical COUNT. Skip-if-clean: a unit
 * with no changed files is not reviewed (returns 0). A dead reviewer degrades to
 * zero findings and NEVER blocks — the deterministic verify is the real gate (J4).
 */
async function runDiffReview({ unit, unitNum, manifest, workingDir, diffReviewers }) {
  const changed = manifest && Array.isArray(manifest.changed_files) ? manifest.changed_files : null;
  if (changed && changed.length === 0) {
    log(`diff-review: unit ${unitNum} changed no files — skip`);
    return 0;
  }
  const diffPath = manifest && manifest.diff_path;
  if (!diffPath) {
    log(`diff-review: unit ${unitNum} has no diff path — skip (fail-open)`);
    return 0;
  }
  const n = Number.isFinite(diffReviewers) && diffReviewers >= 2 ? Math.floor(diffReviewers) : 2;
  const lenses = Array.from({ length: n }, (_u, i) => DIFF_REVIEW_LENSES[i % DIFF_REVIEW_LENSES.length]);
  const outputs = await parallel(
    lenses.map((lens, i) => () =>
      agent(diffReviewPrompt(diffPath, unit, workingDir || '.', lens, i + 1, n), {
        label: `diff-review:unit-${unitNum}-r${i + 1}`,
        phase: 'Diff-review',
        schema: FINDINGS_SCHEMA,
      }),
    ),
  );
  const perReviewer = outputs.map((o) => (o && Array.isArray(o.findings) ? o.findings : []));
  const aggregated = consensusAggregate(perReviewer);
  const blocking = aggregated.filter((f) => f && f.severity === 'critical');
  if (blocking.length > 0) {
    log(`diff-review: unit ${unitNum} — ${blocking.length} consensus-Critical finding(s): ${JSON.stringify(blocking)}`);
  } else {
    log(`diff-review: unit ${unitNum} — no consensus-Critical findings (clean / fail-open)`);
  }
  return blocking.length;
}

// ---------------------------------------------------------------------------
// Entrypoint. The bundler appends `return await main(args)` at the top level;
// `args` arrives as a JSON string (parse it), and the returned report is the
// workflow's result. main stays a plain export so a test can import + drive it.
// ---------------------------------------------------------------------------

/** Parse the Workflow `args` global, which arrives as a JSON string (or object). */
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
  const { units, workingDir, cap, diffReviewers = 2 } = input;
  const unitList = Array.isArray(units) ? units : [];

  log(
    `phasing-flow-engine: ${unitList.length} unit(s) workingDir=${workingDir ?? '(current)'} ` +
      `cap=${cap ?? '(all)'} diffReviewers=${diffReviewers}`,
  );

  const report = await runPhasingFlowExecution({
    units: unitList,
    executeUnit,
    verify: runVerify,
    diffReview: (ctx) => runDiffReview({ ...ctx, diffReviewers }),
    budget,
    cap,
    workingDir,
  });

  log(
    `exit=${report.exitReason} units=${report.unitsCompleted}/${report.unitsTotal} ` +
      `residual=${report.unitsResidual} budgetSpent=${report.budgetSpent}`,
  );

  return report; // already frozen by the wrapper
}
