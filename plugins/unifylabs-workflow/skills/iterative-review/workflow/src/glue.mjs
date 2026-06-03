// glue.mjs — the agent()-backed SOURCE for the iterative-review Workflow.
//
// THIS IS THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase /
// log / args / budget). It is NOT unit-tested (it needs the Workflow runtime),
// but it MUST `node --check` clean and MUST avoid the forbidden wall-clock/random
// tokens so the recursive determinism guard stays green.
//
// REAL Workflow API (proven 2026-06-03 by probe wf_5ffc08f3-c30 + the N=3×6
// reviewer de-risk; supersedes the phantom API the first cut was built against):
//   - agent(promptString, { agentType, schema, label, phase }) -> dispatch a
//     sub-agent. With `schema` it returns the validated object; without, its text.
//   - parallel(thunks)  -> NATIVE bounded fan-out (the runtime owns the pool).
//   - phase(title)       -> a progress group; we assign per-agent via the `phase`
//                           OPTION (phase() is a void marker, NOT phase(name,fn)).
//   - log(msg)           -> structured run log.
//   - args               -> the Workflow input; arrives as a JSON STRING (parse it).
//   - budget             -> { spent(), remaining(), total }.
//
// The deterministic bundler (build-workflow.mjs) inlines the tested kernel
// (lib/*.mjs + stopping-engine.mjs + wrapper.mjs) AHEAD of this file's body,
// strips the imports below, and appends a top-level `return await main(args)` —
// the runtime runs the script BODY (there is no exported-entry auto-invocation),
// and the top-level return is the workflow's result.

import { runIterativeReview } from '../wrapper.mjs';
import { normalizeFindings } from '../lib/parse-findings.mjs';
import { consensusAggregate } from '../lib/consensus-aggregate.mjs';
import { resolveVerifier } from '../lib/verifier-detect.mjs';
import { detectMode } from '../lib/mode-detect.mjs';

// `meta` MUST be a pure literal and is emitted FIRST in the bundle — the Workflow
// tool reads { name, description, phases } before executing the body.
export const meta = {
  name: 'iterative-review',
  description:
    'Iterative review-fix-verify loop with severity-gated stopping, run as a Workflow over the tested stopping-engine kernel. Fans out independent reviewers, aggregates Criticals by consensus (>=2 votes), then loops until a provable ceiling fires.',
  phases: [
    { title: 'Review', detail: 'fan out reviewers; consensus-aggregate findings' },
    { title: 'Fix', detail: 'auto-fix the Important working set (delta scope)' },
    { title: 'Verify', detail: 'resolve + run the project verifier' },
  ],
};

// ---------------------------------------------------------------------------
// Reviewer sets. Code mode fans out the pr-review-toolkit specialists (proven to
// resolve + behave as fixture reviewers in a Workflow agent() call). Doc mode
// runs a single general reviewer with a documentation lens. The runtime's NATIVE
// parallel() bounds the fan-out — we do NOT hand-roll a concurrency limiter.
// `agentType: null` => the default workflow subagent (no custom type).
// ---------------------------------------------------------------------------

const CODE_REVIEWERS = [
  { agentType: 'pr-review-toolkit:code-reviewer', short: 'code-reviewer', lens: 'general correctness and runtime-safety bugs (null/undefined deref, logic errors, async/await correctness)' },
  { agentType: 'pr-review-toolkit:silent-failure-hunter', short: 'silent-failure', lens: 'silent failures, swallowed/empty-catch errors, missing await / unhandled rejection, inadequate error logging' },
  { agentType: 'pr-review-toolkit:pr-test-analyzer', short: 'test-analyzer', lens: 'test-coverage gaps for the changed code (untested branches, missing edge-case tests)' },
  { agentType: 'pr-review-toolkit:comment-analyzer', short: 'comment-analyzer', lens: 'comment accuracy / comment rot — comments that contradict or misdescribe the code' },
  { agentType: 'pr-review-toolkit:type-design-analyzer', short: 'type-design', lens: 'type design, encapsulation, invariant gaps in the public contracts' },
  { agentType: 'pr-review-toolkit:code-simplifier', short: 'simplifier', lens: 'simplification, refactor opportunities, duplication, naming' },
];

const DOC_REVIEWERS = [
  { agentType: null, short: 'doc-reviewer', lens: 'documentation accuracy: broken file references, internal contradictions, instructions that do not match the code/spec' },
];

// ---------------------------------------------------------------------------
// LEAN schemas (per the structured-output-pitfall: few flat fields, no hyphenated
// keys — keeps specialist subagents from skipping StructuredOutput).
// ---------------------------------------------------------------------------

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
          score: { type: 'integer' },
        },
        required: ['file', 'line', 'severity'],
      },
    },
  },
  required: ['findings'],
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

// ---------------------------------------------------------------------------
// Prompt builders (generic — no benchmark-specific text; a diff-text input
// naturally yields diff-text line citations, which the no-regression scorer
// normalizes, while a real working tree yields real file:line citations).
// ---------------------------------------------------------------------------

function reviewPrompt({ mode, target, workingDir, lens, scope }) {
  const lines = [
    `You are reviewing a ${mode === 'doc' ? 'documentation' : 'code'} change under review. Report only genuine defects.`,
    `Target under review: ${target ?? '(the diff in the working directory)'}.`,
    `Working directory: ${workingDir ?? '(current)'}.`,
    'If the target is a file path, read that file and review its contents as the change under review. Do not run git or modify anything.',
    `Apply your specialty: ${lens}.`,
    '',
    'Severity policy (assign each finding a 0-100 confidence and a tier):',
    '- critical: confidence >= 90 AND the defect will break runtime behavior (null/undefined deref, logic error, race), is a security issue, or is a clear contract violation. Reserve critical for genuinely runtime-breaking or data/money-corrupting defects you are highly confident about; do NOT over-escalate quality/robustness nits.',
    '- important: confidence 80-89 — missing edge-case handling, silent failure / swallowed error, missing await, type/robustness weakness, test gap, comment rot.',
    '- suggestion: confidence < 80, or style / refactor / duplication / naming / cosmetic.',
    '',
    'Cite each finding by <file>:<line> using the line number where the issue appears in what you reviewed (for a diff, the line of the relevant changed line as shown to you).',
  ];
  if (Array.isArray(scope) && scope.length > 0) {
    lines.push(`Focus this pass on these files (delta re-review): ${scope.join(', ')}.`);
  }
  lines.push('Return findings per the schema. If you find nothing meeting the bar within your lens, return an empty findings array.');
  return lines.join('\n');
}

function fixPrompt(group, workingDir) {
  return [
    `Apply the MINIMAL fix for ONLY the findings listed below, in the working directory: ${workingDir ?? '(current)'}.`,
    'Constraints: fix ONLY these findings; do NOT refactor surrounding code; do NOT change anything not required by a listed finding.',
    `Findings (JSON): ${JSON.stringify(group)}`,
    'After editing, briefly state what you changed.',
  ].join('\n');
}

function scoutPrompt(workingDir) {
  return [
    `Inspect the project's build/test configuration in: ${workingDir ?? '(current)'}. Do NOT run anything; only read files that exist.`,
    'Return, for files that exist:',
    '- packageJson: the raw text of package.json (if present)',
    '- pyprojectToml: the raw text of pyproject.toml (if present)',
    '- makefile: the raw text of Makefile (if present)',
    "- lockfiles: filenames present among pnpm-lock.yaml, yarn.lock, bun.lockb, bun.lock, package-lock.json",
    "- otherFiles: present names among Cargo.toml, go.mod, requirements.txt, Gemfile, setup.cfg, and the directory markers 'tests/' and 'spec/'",
    'Omit any field whose file is absent.',
  ].join('\n');
}

function runnerPrompt(cmd, workingDir) {
  return [
    `Run this verifier command in ${workingDir ?? '(current)'}: ${cmd}`,
    "Return verdict='pass' if it exits 0; verdict='fail' if it exits non-zero (test/check failure); verdict='fail-permanent' if the command itself is missing or cannot be run at all (not a test failure).",
  ].join('\n');
}

function reviewersFor(mode) {
  return mode === 'doc' ? DOC_REVIEWERS : CODE_REVIEWERS;
}

// ---------------------------------------------------------------------------
// Effectful steps (the only agent()-calling code).
// ---------------------------------------------------------------------------

/**
 * Fan out the mode's reviewers via NATIVE parallel(), normalize each output, then
 * apply the consensus precision stage. Returns the aggregated findings array.
 * A reviewer that returns null/garbage degrades to zero findings (never throws).
 */
async function fanOutReview({ mode, target, workingDir, scope }) {
  const reviewers = reviewersFor(mode);
  const outputs = await parallel(
    reviewers.map((r) => () => {
      const opts = { label: `review:${r.short}`, phase: 'Review', schema: FINDINGS_SCHEMA };
      if (r.agentType) opts.agentType = r.agentType;
      return agent(reviewPrompt({ mode, target, workingDir, lens: r.lens, scope }), opts);
    }),
  );
  const perReviewer = outputs.map((out) => normalizeFindings(out));
  const aggregated = consensusAggregate(perReviewer);
  return aggregated;
}

/**
 * Fixer — dispatch a default agent per file group (serialized by file so two
 * agents never edit the same file; non-overlapping files run via parallel()).
 */
async function fanOutFix({ findings, workingDir }) {
  const byFile = new Map();
  for (const f of findings ?? []) {
    const key = f.file || '';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(f);
  }
  const groups = Array.from(byFile.values());
  if (groups.length === 0) return;
  await parallel(
    groups.map((group) => () => agent(fixPrompt(group, workingDir), { label: 'fix', phase: 'Fix' })),
  );
}

/**
 * Verify — a scout agent reads the project files (pure i/o), resolveVerifier
 * (tested) turns them into the command list, then a runner agent runs each and
 * reports a verdict. Returns 'pass' | 'fail' | 'fail-permanent'.
 */
async function runVerify({ workingDir }) {
  const projectFiles = await agent(scoutPrompt(workingDir), {
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
    const res = await agent(runnerPrompt(cmd, workingDir), {
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
  const {
    target,
    mode,
    cap = 3,
    skipClean = true,
    includeSuggestions = false,
    gateImportant = false,
    workingDir,
  } = input;

  const resolvedMode = mode ?? detectMode(target);
  log(`iterative-review: mode=${resolvedMode} target=${target ?? '(auto)'} gateImportant=${gateImportant}`);

  // Callbacks close over the resolved mode/target/workingDir — the engine calls
  // reviewRound() WITHOUT them (only {round, prevFindings, ...}), so they must be
  // captured here, not read from the engine's per-round ctx.
  let initialFindings = [];

  const initialReview = async () => {
    const findings = await fanOutReview({ mode: resolvedMode, target, workingDir, scope: null });
    initialFindings = findings;
    log(`initial review: ${findings.length} consensus finding(s)`);
    return findings;
  };

  const reviewRound = async ({ prevFindings } = {}) => {
    const scope = (prevFindings ?? []).map((f) => f.file).filter(Boolean);
    return fanOutReview({ mode: resolvedMode, target, workingDir, scope });
  };

  const applyFixes = async ({ findings } = {}) => fanOutFix({ findings, workingDir });

  const verify = async () => runVerify({ workingDir });

  const report = await runIterativeReview({
    mode: resolvedMode,
    target,
    initialReview,
    reviewRound,
    applyFixes,
    verify,
    budget,
    cap,
    skipClean,
    includeSuggestions,
    gateImportant,
    workingDir,
  });

  log(
    `exit=${report.exitReason} rounds=${report.roundsRun} ` +
      `residualCritical=${report.residualCritical} resolved=${report.resolved}`,
  );

  // Surface the consensus-aggregated initial findings alongside the engine report
  // so the no-regression live gate can score detection quality from the return.
  return Object.freeze({ ...report, findings: Object.freeze(initialFindings) });
}
