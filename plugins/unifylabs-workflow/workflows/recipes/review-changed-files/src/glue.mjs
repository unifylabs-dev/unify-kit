// glue.mjs — the agent()-backed SOURCE for the review-changed-files reference
// recipe (M4 /workflow-library).
//
// THE ONLY FILE THAT TOUCHES RUNTIME GLOBALS (agent / parallel / phase / log /
// args). NOT unit-tested (needs the Workflow runtime) — it MUST `node --check`
// clean and avoid wall-clock/random tokens. The pure kernel (lib/consensus.mjs)
// IS unit-tested; this file only orchestrates the agents and hands their findings
// to the kernel.
//
// THE PATTERN THIS RECIPE TEACHES (the canonical Workflow review shape): fan out
// one reviewer per DIMENSION over a git diff via parallel() [a barrier — consensus
// needs every reviewer's findings together], reach Critical-precision consensus in
// the pure kernel, then adversarially VERIFY each confirmed Critical via a second
// parallel(). READ-ONLY throughout: every agent is told to review, never mutate;
// the recipe writes nothing to the tree. The bundler appends `return await
// main(args)`.

import { consensusAggregate, normalizeFinding, buildReport } from '../lib/consensus.mjs';

// `meta` MUST be a pure literal, emitted FIRST. No variables / calls / spreads /
// template strings / string concatenation (a `+` is a rejected BinaryExpression).
export const meta = {
  name: 'review-changed-files',
  description:
    'Reference recipe (M4 /workflow-library): review a git diff across N dimensions in parallel, reach Critical-precision consensus (a Critical survives only if >=critVotes reviewers tier it within +/-tolerance lines), then adversarially verify each confirmed Critical. READ-ONLY — every agent reviews, never mutates; the recipe writes nothing to the working tree. JSON args: diffRange (default HEAD~1...HEAD), dimensions (default correctness/security/error_handling), critVotes (default 2), tolerance (default 3), workingDir.',
  phases: [
    { title: 'Review', detail: 'one reviewer agent per dimension over the diff' },
    { title: 'Verify', detail: 'adversarially refute each consensus-confirmed Critical' },
  ],
};

// ---------------------------------------------------------------------------
// LEAN schemas (structured-output-pitfall: few flat snake_case fields, shallow
// nesting — keeps subagents from skipping StructuredOutput → null).
// ---------------------------------------------------------------------------

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'line', 'severity', 'description'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['critical', 'important', 'suggestion'] },
          description: { type: 'string' },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['refuted'],
  properties: {
    refuted: { type: 'boolean' },
    note: { type: 'string' },
  },
};

const DEFAULT_DIMENSIONS = [
  {
    key: 'correctness',
    lens: 'logic errors, off-by-one, null/undefined deref, inverted conditionals, broken control flow, resource leaks',
  },
  {
    key: 'security',
    lens: 'injection, hardcoded secrets, auth/authz gaps, unsafe input handling, unprotected public mutations',
  },
  {
    key: 'error_handling',
    lens: 'swallowed exceptions, missing failure paths, silent fallbacks that hide errors, unhandled rejections',
  },
];

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

function reviewPrompt(dim, diffRange, workingDir) {
  const cd = workingDir ? `Work in the repo at ${workingDir}. ` : '';
  return (
    `${cd}You are a READ-ONLY code reviewer. Run \`git diff ${diffRange}\` and review ONLY the changed lines, through ONE lens: ` +
    `${dim.key} — ${dim.lens}.\n\n` +
    'For each genuine issue return a finding: the file path (the diff hunk\'s `+++ b/<file>` target, NOT the patch/container file), ' +
    'the line number in the NEW file, a severity (critical = a bug/vuln that will bite in production; important = a real defect worth ' +
    'fixing; suggestion = a nit), and a one-line description. Cite the NEW-file line precisely so cross-reviewer consensus can locate it. ' +
    'Do NOT edit, stage, commit, or push anything — review only. If your lens finds nothing, return an empty findings array.'
  );
}

function verifyPrompt(f, diffRange, workingDir) {
  const cd = workingDir ? `Work in the repo at ${workingDir}. ` : '';
  return (
    `${cd}You are an ADVERSARIAL verifier. A reviewer flagged a CRITICAL issue:\n` +
    `  file: ${f.file}\n  line: ${f.line}\n  claim: ${f.description}\n\n` +
    `Run \`git diff ${diffRange}\` and read the actual changed code. Try HARD to REFUTE the claim — is it a real production-biting ` +
    'critical, or a false positive / already-handled elsewhere / not actually on this diff? Default to refuted=true if you cannot ' +
    'positively confirm it is a real critical. READ-ONLY: do not edit anything. Return {refuted: boolean, note: one short line}.'
  );
}

async function main(rawArgs) {
  const args = parseArgs(rawArgs);
  const diffRange =
    typeof args.diffRange === 'string' && args.diffRange ? args.diffRange : 'HEAD~1...HEAD';
  const dimensions =
    Array.isArray(args.dimensions) && args.dimensions.length ? args.dimensions : DEFAULT_DIMENSIONS;
  const critVotes = Number.isFinite(Number(args.critVotes)) ? Number(args.critVotes) : 2;
  const tolerance = Number.isFinite(Number(args.tolerance)) ? Number(args.tolerance) : 3;
  const workingDir = typeof args.workingDir === 'string' ? args.workingDir : '';

  log(`review-changed-files: ${dimensions.length} dimension(s) over ${diffRange}`);

  // REVIEW — one reviewer per dimension, in parallel. This is a BARRIER: consensus
  // needs every reviewer's findings together before it can count votes.
  const perReviewer = await parallel(
    dimensions.map((d) => () =>
      agent(reviewPrompt(d, diffRange, workingDir), {
        label: `review:${d.key}`,
        phase: 'Review',
        schema: FINDINGS_SCHEMA,
      }).then((r) => (r && Array.isArray(r.findings) ? r.findings.map(normalizeFinding) : []))
    )
  );

  // CONSENSUS — a Critical survives only with >=critVotes within +/-tolerance lines.
  const confirmed = consensusAggregate(perReviewer, { critVotes, tolerance });
  const criticals = confirmed.filter((f) => f.severity === 'critical');
  log(`consensus: ${confirmed.length} finding(s), ${criticals.length} confirmed critical(s)`);

  // VERIFY — adversarially refute each confirmed Critical. FAIL-OPEN: a thrown or
  // null verdict does NOT silently drop the finding; it is kept as unrefuted so a
  // broken verifier can never hide a real Critical.
  const verdicts = await parallel(
    criticals.map((f) => () =>
      agent(verifyPrompt(f, diffRange, workingDir), {
        label: `verify:${f.file}:${f.line}`,
        phase: 'Verify',
        schema: VERDICT_SCHEMA,
      })
        .then((v) => ({ ...f, refuted: v?.refuted === true, note: v?.note ?? '' }))
        .catch(() => ({ ...f, refuted: false, note: 'verifier errored — kept (fail-open)' }))
    )
  );

  return buildReport({ diffRange, dimensions, confirmed, verdicts });
}
