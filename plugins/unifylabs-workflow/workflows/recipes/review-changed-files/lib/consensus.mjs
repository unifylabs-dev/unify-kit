// consensus.mjs — PURE, import-free consensus + report kernel for the
// review-changed-files reference recipe (M4 /workflow-library).
//
// SELF-CONTAINED by design: a reference recipe meant to be COPIED must not depend
// on a copied internal kit lib, so this re-expresses the Critical-precision
// consensus rule (proven in iterative-review's consensus-aggregate) in a small,
// recipe-local form. Its own arithmetic is unit-tested + RED-guarded by CI.
//
// Determinism: no agent()/parallel()/Date/random/i-o — a pure transform over its
// inputs, so it bundles into the Workflow VM and is testable with plain node:test.

// Coerce a raw line value to a finite number, or null when it is unlocatable.
// CRITICAL subtlety: `Number(null)` and `Number('')` are `0` (finite), so a
// missing line would otherwise masquerade as line 0 — locatable, able to vote in
// consensus, and able to collide on dedup. Guard null/undefined/'' explicitly.
export function toFiniteLine(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Canonical dedup key: file + new-file line + severity + normalized description.
// Two reviewers reporting the same issue collapse to one so the Critical count is
// honest.
export function canonicalKey(f) {
  const file = String(f?.file ?? '').trim();
  const ln = toFiniteLine(f?.line);
  const line = ln === null ? '?' : ln;
  const sev = String(f?.severity ?? '').trim().toLowerCase();
  const desc = String(f?.description ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return `${file}:${line}:${sev}:${desc}`;
}

// Normalize one raw reviewer finding to {file,line,severity,description}. An
// unrecognized severity falls back to 'suggestion' (the safe, non-gating tier); a
// non-numeric line becomes null (an unlocatable Critical cannot win a consensus
// vote — it has no neighborhood).
export function normalizeFinding(raw) {
  const sevRaw = String(raw?.severity ?? '').trim().toLowerCase();
  const severity =
    sevRaw === 'critical' || sevRaw === 'important' || sevRaw === 'suggestion'
      ? sevRaw
      : 'suggestion';
  return {
    file: String(raw?.file ?? '').trim(),
    line: toFiniteLine(raw?.line),
    severity,
    description: String(raw?.description ?? '').trim(),
  };
}

// Consensus aggregation: a Critical-tier finding survives as Critical ONLY if at
// least `critVotes` DISTINCT reviewers independently tier a Critical within
// ±`tolerance` lines of it (same file). Otherwise it is demoted to 'important'.
// This kills a lone reviewer's stochastic over-escalation while preserving the
// real Criticals every reviewer catches. Then dedup by canonicalKey.
export function consensusAggregate(perReviewerFindings, opts = {}) {
  const critVotes = Number.isFinite(Number(opts.critVotes)) ? Number(opts.critVotes) : 2;
  const tolerance = Number.isFinite(Number(opts.tolerance)) ? Number(opts.tolerance) : 3;
  const lists = (perReviewerFindings ?? []).map((l) => (Array.isArray(l) ? l : []));

  // The vote ledger: every reviewer's LOCATABLE Criticals, tagged with the
  // reviewer index that produced them.
  const criticalVotes = [];
  lists.forEach((list, reviewer) => {
    for (const f of list) {
      if (!f || f.severity !== 'critical') continue;
      const line = toFiniteLine(f.line);
      if (line === null) continue; // an unlocatable Critical cannot vote.
      criticalVotes.push({ file: String(f.file ?? ''), line, reviewer });
    }
  });

  // Distinct reviewers with a Critical within ±tolerance of (file,line). If A cites
  // :49 and B cites :51 with tolerance 3, each sees the other → both reach 2.
  const voteCount = (file, line) => {
    const voters = new Set();
    for (const v of criticalVotes) {
      if (v.file === file && Math.abs(v.line - line) <= tolerance) voters.add(v.reviewer);
    }
    return voters.size;
  };

  // Tier-correct: demote any Critical that fails to reach critVotes.
  const corrected = [];
  for (const list of lists) {
    for (const f of list) {
      if (!f) continue;
      let severity = f.severity;
      if (severity === 'critical') {
        const line = toFiniteLine(f.line);
        const confirmed = line !== null && voteCount(String(f.file ?? ''), line) >= critVotes;
        severity = confirmed ? 'critical' : 'important';
      }
      corrected.push({ ...f, severity });
    }
  }

  // Dedup by the canonical key.
  const seen = new Set();
  const out = [];
  for (const f of corrected) {
    const key = canonicalKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// Frozen report builder. `verdicts` are the consensus-confirmed Criticals after
// the adversarial verify pass, each tagged {refuted:boolean}. A refuted Critical
// is excluded from criticals_confirmed but retained under criticals_refuted for
// transparency.
export function buildReport({ diffRange, dimensions, confirmed, verdicts } = {}) {
  const findings = Array.isArray(confirmed) ? confirmed : [];
  const verds = Array.isArray(verdicts) ? verdicts : [];
  const bySeverity = { critical: 0, important: 0, suggestion: 0 };
  for (const f of findings) {
    if (f && bySeverity[f.severity] !== undefined) bySeverity[f.severity] += 1;
  }
  const realCriticals = verds.filter((v) => v && v.refuted !== true);
  const refutedCriticals = verds.filter((v) => v && v.refuted === true);
  return Object.freeze({
    recipe: 'review-changed-files',
    diff_range: String(diffRange ?? ''),
    dimensions_run: Array.isArray(dimensions) ? dimensions.map((d) => d && d.key) : [],
    findings_total: findings.length,
    by_severity: bySeverity,
    criticals_confirmed: realCriticals.length,
    criticals_refuted: refutedCriticals.length,
    findings,
    verified_criticals: realCriticals,
  });
}
