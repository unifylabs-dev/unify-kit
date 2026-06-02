// glue.mjs — the agent()-backed SOURCE for the iterative-review Workflow.
//
// THIS IS THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase /
// log / budget). It is NOT unit-tested (it needs the Workflow runtime), but it
// MUST `node --check` clean and MUST avoid the forbidden wall-clock/random
// tokens so the recursive determinism guard stays green.
//
// The deterministic bundler (build-workflow.mjs) inlines the tested kernel
// (lib/*.mjs + stopping-engine.mjs + wrapper.mjs) AHEAD of this file's body and
// strips the imports below — so `runIterativeReview`, `normalizeFindings`,
// `resolveVerifier`, and `detectMode` are already in scope in the generated
// bundle. We still write them as real imports here so this source file resolves
// and `node --check`s on its own.
//
// Runtime globals assumed present in the Workflow VM (NOT imported — the bundle
// strips imports, and these are provided by the runtime):
//   - agent(spec)        -> dispatch a sub-agent; returns its structured output
//   - parallel(tasks)    -> NATIVE bounded fan-out (no hand-rolled concurrency
//                           limiter — the runtime owns the worker pool)
//   - phase(name, fn)    -> demarcate a workflow phase for the run log
//   - log(msg)           -> structured run log
//   - budget             -> the runtime budget object
//                           { spent(), remaining(), total }

import { runIterativeReview } from '../wrapper.mjs';
import { normalizeFindings } from '../lib/parse-findings.mjs';
import { resolveVerifier } from '../lib/verifier-detect.mjs';
import { detectMode } from '../lib/mode-detect.mjs';

// `meta` MUST be a pure literal and MUST be emitted FIRST in the bundle — the
// Workflow tool reads it to discover the entrypoint + declared inputs before
// executing anything.
export const meta = {
  name: 'iterative-review',
  version: 1,
  entry: 'main',
  description:
    'Iterative review-fix-verify loop with severity-gated stopping, run as a ' +
    'Workflow over the tested stopping-engine kernel.',
  inputs: {
    target: { type: 'string', required: false },
    mode: { type: 'string', required: false, enum: ['code', 'doc', 'phase'] },
    cap: { type: 'number', required: false, default: 3 },
    skipClean: { type: 'boolean', required: false, default: true },
    includeSuggestions: { type: 'boolean', required: false, default: false },
    gateImportant: { type: 'boolean', required: false, default: false },
    workingDir: { type: 'string', required: false },
  },
};

// ---------------------------------------------------------------------------
// The review reviewer-set, by mode. Code mode fans out the pr-review-toolkit
// specialists; doc mode runs the single doc-reviewer. The runtime's NATIVE
// parallel() bounds the fan-out — we do NOT hand-roll a min(16, cores-2)
// limiter.
// ---------------------------------------------------------------------------

const CODE_REVIEWERS = [
  'code-reviewer',
  'silent-failure-hunter',
  'pr-test-analyzer',
  'comment-analyzer',
  'type-design-analyzer',
  'code-simplifier',
];

/**
 * Build the agent spec for one reviewer over the target.
 */
function reviewerSpec(name, { mode, target, workingDir }) {
  return {
    agent: name,
    input: { mode, target, workingDir, task: 'review' },
  };
}

/**
 * Initial review pass — fan out the mode-appropriate reviewers via NATIVE
 * parallel(), then normalize + aggregate their outputs into engine findings.
 */
async function initialReview({ mode, target, workingDir }) {
  const reviewers =
    mode === 'doc' ? ['doc-reviewer'] : CODE_REVIEWERS;

  const outputs = await parallel(
    reviewers.map((name) => () =>
      agent(reviewerSpec(name, { mode, target, workingDir })),
    ),
  );

  // Each agent output -> normalized findings; concat into one list.
  const findings = [];
  for (const out of outputs) {
    for (const f of normalizeFindings(out)) findings.push(f);
  }
  log(`initial review: ${findings.length} finding(s) across ${reviewers.length} reviewer(s)`);
  return findings;
}

/**
 * Per-round re-review — delta scope only (the files touched by the round's
 * fixes plus files of unresolved findings). The runtime passes prevFindings.
 */
async function reviewRound({ mode, target, workingDir, prevFindings }) {
  const reviewers = mode === 'doc' ? ['doc-reviewer'] : CODE_REVIEWERS;
  const scope = (prevFindings ?? []).map((f) => f.file).filter(Boolean);

  const outputs = await parallel(
    reviewers.map((name) => () =>
      agent({
        agent: name,
        input: { mode, target, workingDir, task: 'review', scope },
      }),
    ),
  );

  const findings = [];
  for (const out of outputs) {
    for (const f of normalizeFindings(out)) findings.push(f);
  }
  return findings;
}

/**
 * Fixer — dispatch a fixer agent for the auto-fixable working set. Serialized
 * by file to avoid two agents editing the same file; non-overlapping files run
 * via the runtime's native parallel().
 */
async function applyFixes({ findings, workingDir }) {
  const byFile = new Map();
  for (const f of findings ?? []) {
    const key = f.file || '';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(f);
  }
  const groups = Array.from(byFile.values());
  await parallel(
    groups.map((group) => () =>
      agent({
        agent: 'fixer',
        input: {
          workingDir,
          task: 'apply-fix',
          findings: group,
          constraint: 'fix ONLY these findings; do not refactor surroundings',
        },
      }),
    ),
  );
}

/**
 * Verify — resolve the verifier command list from the project files (read by a
 * scout agent), then run each via a Bash-capable agent. Returns the engine's
 * verdict vocabulary: 'pass' | 'fail' | 'fail-permanent'.
 */
async function verify({ workingDir }) {
  // A scout agent reads the project-root files we need to resolve the verifier
  // (pure resolution happens in resolveVerifier; the agent only does the i/o).
  const projectFiles = await agent({
    agent: 'verifier-scout',
    input: { workingDir, task: 'read-project-files' },
  });
  const commands = resolveVerifier(projectFiles ?? {});
  if (commands.length === 0) {
    log('verify: no verifier commands resolved — treating as pass');
    return 'pass';
  }

  for (const cmd of commands) {
    const res = await agent({
      agent: 'verifier-runner',
      input: { workingDir, task: 'run', command: cmd },
    });
    if (res && res.verdict === 'fail-permanent') return 'fail-permanent';
    if (res && res.verdict === 'fail') return 'fail';
  }
  return 'pass';
}

// ---------------------------------------------------------------------------
// Entrypoint — bind the runtime budget + inputs and run the wrapper.
// ---------------------------------------------------------------------------

export async function main(inputs = {}) {
  const {
    target,
    mode,
    cap = 3,
    skipClean = true,
    includeSuggestions = false,
    gateImportant = false,
    workingDir,
  } = inputs;

  const resolvedMode = mode ?? detectMode(target);

  return phase('iterative-review', async () => {
    log(`mode=${resolvedMode} target=${target ?? '(auto)'}`);
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
    return report;
  });
}
