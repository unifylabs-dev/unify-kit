// audit-aggregate.mjs — pure transforms that bridge the agent layer (D4
// reviewers, D2 runner) to the pure reduce (compute-audit.mjs). Turns raw
// reviewer findings + a project's resolved verifier commands into the
// deterministic SIGNAL counts the reduce consumes. Imports the copied libs
// (the bundler inlines them; ADR 0003 — no cross-import at runtime).
//
//   D4: consensus-aggregate the 6-lens fan-out at critVotes=1 (OD2 — dedup-only
//       for the SEMANTICALLY-DISTINCT pr-review-toolkit lenses, which almost
//       never co-locate; critVotes=2 would gut D4's critical signal). naiveD4 is
//       the no-consensus reference verdict-parity Gate B compares against.
//   D2: role-tag resolveVerifier's flat command list into build/tsc/test
//       buckets, with the OD4 synthetic `npx tsc --noEmit` fallback when a
//       tsconfig.json exists but no `typecheck` script emitted a tsc command —
//       so de-hardwiring D2 does not silently drop the −30 tsc gate.

import { consensusAggregate } from './lib/consensus-aggregate.mjs';
import { resolveVerifier } from './lib/verifier-detect.mjs';

export const D4_CRIT_VOTES = 1; // OD2.

/** Map a reviewer finding {file,line,severity,summary} → the canonical shape
 *  (consensus-aggregate + canonical dedup on `description`, not `summary`). */
function toFinding(f) {
  return {
    file: String(f?.file ?? ''),
    line: f?.line,
    severity: String(f?.severity ?? '').toLowerCase(),
    description: String(f?.summary ?? f?.description ?? ''),
  };
}

/** Count findings by severity tier. */
export function countSeverities(findings) {
  const c = { critical: 0, important: 0, suggestion: 0 };
  for (const f of findings ?? []) {
    const s = String(f?.severity ?? '').toLowerCase();
    if (s === 'critical') c.critical += 1;
    else if (s === 'important') c.important += 1;
    else if (s === 'suggestion') c.suggestion += 1;
  }
  return c;
}

/**
 * D4 counts AFTER consensus aggregation. With critVotes=1 this is dedup-only
 * (every locatable critical kept); an UNLOCATABLE critical (non-finite line)
 * still demotes, so the lean D4 schema makes `line` first-class.
 * @param {Array<Array<object>>} perReviewerFindings  one findings array per reviewer
 * @returns {{critical:number, important:number, suggestion:number}}
 */
export function aggregateD4(perReviewerFindings, { critVotes = D4_CRIT_VOTES } = {}) {
  const lists = (perReviewerFindings ?? []).map((l) => (Array.isArray(l) ? l.map(toFinding) : []));
  return countSeverities(consensusAggregate(lists, { critVotes }));
}

/** Naive D4 counts: flatten ALL reviewer findings, no consensus, no dedup — the
 *  verdict-parity Gate B reference (computeD4Naive). */
export function naiveD4(perReviewerFindings) {
  const flat = (perReviewerFindings ?? []).flatMap((l) => (Array.isArray(l) ? l.map(toFinding) : []));
  return countSeverities(flat);
}

// --- D2 role-tagging -------------------------------------------------------

/** Classify a resolved verifier command into a D2 scoring bucket. */
export function d2Bucket(cmd) {
  const c = String(cmd ?? '').toLowerCase();
  if (c.includes('build')) return 'build';
  if (c.includes('tsc') || c.includes('typecheck')) return 'tsc';
  if (/\b(test|pytest|rspec)\b/.test(c) || c.includes('go test') || c.includes('cargo test')) return 'test';
  return 'other'; // lint / vet / check — not scored by D2.
}

/**
 * Resolve D2 commands from project file contents, tagged to buckets, with the
 * OD4 synthetic tsc fallback: a tsconfig.json present but no emitted `tsc`
 * command (e.g. a JS project with no `typecheck` script) injects
 * `npx tsc --noEmit` so the −30 tsc gate is preserved.
 * @returns {Array<{cmd:string, bucket:string, synthetic?:boolean}>}
 */
export function resolveD2Commands(projectFiles = {}) {
  const cmds = resolveVerifier(projectFiles).map((cmd) => ({ cmd, bucket: d2Bucket(cmd) }));
  const others = new Set(projectFiles.otherFiles ?? []);
  if (others.has('tsconfig.json') && !cmds.some((c) => c.bucket === 'tsc')) {
    cmds.push({ cmd: 'npx tsc --noEmit', bucket: 'tsc', synthetic: true });
  }
  return cmds;
}

/**
 * Map runner results (per tagged command: {bucket, pass}) → the D2 signal counts
 * compute-audit.scoreD2 consumes. A failed build/tsc/test command sets its
 * bucket's *_fail to 1. (untested_new is computed separately by the glue.)
 * @param {Array<{bucket:string, pass:boolean}>} results
 * @returns {{build_fail:0|1, tsc_fail:0|1, tests_fail:0|1}}
 */
export function d2SignalsFromResults(results = []) {
  const failed = (bucket) => (results.some((r) => r.bucket === bucket && r.pass === false) ? 1 : 0);
  return { build_fail: failed('build'), tsc_fail: failed('tsc'), tests_fail: failed('test') };
}
