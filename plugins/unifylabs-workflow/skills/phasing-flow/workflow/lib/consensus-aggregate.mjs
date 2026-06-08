// consensus-aggregate.mjs — the Critical-PRECISION stage for the multi-reviewer
// fan-out (M1 engine adapter).
//
// WHY THIS EXISTS (proven by the 2026-06-03 de-risk): the iterative-review loop
// fans out N independent review agents and unions their findings. The legacy
// aggregation rule (severity-policy.md §"Aggregation across multiple agents":
// "pick the highest severity") is PRECISION-FRAGILE — a single reviewer that
// stochastically over-escalates one Important to Critical becomes the run's
// verdict, failing the no-regression trust gate's FP≤0 criterion. A faithful
// N=3 × 6-reviewer run over the frozen benchmark did exactly this (one reviewer
// scored a gold-Important missing-await at 90 → Critical) → worst-of-N FP = 1.
//
// THE RULE: a Critical-tier finding survives as Critical ONLY if at least
// `critVotes` DISTINCT reviewers independently tier a Critical within ±`tolerance`
// lines of it (same file). Otherwise it is demoted to 'important'. The real,
// unanimous Criticals (caught by every reviewer) are never dropped; a lone
// over-escalation is. Validated to flip the gate FAIL→PASS on captured live data
// while preserving recall, with the unmodified run-no-regression-eval.mjs scorer.
//
// The per-finding NEIGHBORHOOD vote (count distinct reviewers with a Critical
// within ±tolerance of THIS finding) tolerates moderate cross-reviewer line drift:
// if A cites :49 and B cites :51 (tolerance 3), each sees the other → both ≥2.
//
// Determinism: pure transform over its inputs. No wall-clock, no random, no i/o.

import { canonical } from './canonical.mjs';

/**
 * Apply consensus aggregation to per-reviewer findings.
 *
 * @param {Array<Array<object>>} perReviewerFindings  one normalized-findings
 *        array per reviewer (each finding {file,line,severity,score?,description?},
 *        severity already resolved to 'critical'|'important'|'suggestion').
 * @param {object} [opts]
 * @param {number} [opts.critVotes=2]  distinct reviewers required to keep a Critical.
 * @param {number} [opts.tolerance=3]  ± line window for "the same Critical".
 * @returns {Array<object>}  flat, deduped findings with lone Criticals demoted.
 */
export function consensusAggregate(perReviewerFindings, { critVotes = 2, tolerance = 3 } = {}) {
  const lists = (perReviewerFindings ?? []).map((l) => (Array.isArray(l) ? l : []));

  // Every reviewer's locatable Criticals, tagged with the reviewer index that
  // produced them — the vote ledger.
  const criticalVotes = [];
  lists.forEach((list, reviewer) => {
    for (const f of list) {
      if (!f || f.severity !== 'critical') continue;
      const line = Number(f.line);
      if (!Number.isFinite(line)) continue; // an unlocatable Critical cannot vote.
      criticalVotes.push({ file: String(f.file ?? ''), line, reviewer });
    }
  });

  // Distinct reviewers with a Critical within ±tolerance of (file,line).
  const voteCount = (file, line) => {
    const voters = new Set();
    for (const v of criticalVotes) {
      if (v.file === file && Math.abs(v.line - line) <= tolerance) voters.add(v.reviewer);
    }
    return voters.size;
  };

  // Tier-correct: demote any Critical that fails to reach `critVotes`.
  const corrected = [];
  for (const list of lists) {
    for (const f of list) {
      if (!f) continue;
      let severity = f.severity;
      if (severity === 'critical') {
        const line = Number(f.line);
        const confirmed = Number.isFinite(line) && voteCount(String(f.file ?? ''), line) >= critVotes;
        severity = confirmed ? 'critical' : 'important';
      }
      corrected.push({ ...f, severity });
    }
  }

  // Dedup by the engine's canonical key (file,line,severity,normalized-desc), so
  // the union of identical findings from multiple reviewers collapses to one and
  // the engine's Critical count is honest.
  const seen = new Set();
  const out = [];
  for (const f of corrected) {
    const key = canonical(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
