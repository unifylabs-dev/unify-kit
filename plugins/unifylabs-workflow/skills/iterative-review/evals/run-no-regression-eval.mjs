#!/usr/bin/env node
'use strict';
//
// run-no-regression-eval.mjs — the M1 no-regression TRUST-GATE scorer.
//
// Scores one-or-more iterative-review run transcripts against the frozen
// code-mode benchmark (benchmark/gold-findings.json) and decides whether the
// enforced loop's verification quality meets-or-beats the human-gated baseline
// (benchmark/baseline.json). This is the binding M1->M2 gate (design §12, §14 #3).
//
// PASS (objective half — Tomer sign-off is the human half, NOT computed here):
//   worst-of-N Critical-recall  >=  baseline worst-run Critical-recall (2/3)
//   AND every run surfaces >=1 Critical  (no-false-clean / skip-if-clean probe)
//   AND worst-of-N Critical false-positives <= baseline worst-run FP (0)   [precision not regressed]
//
// PRECISION (false positive) DEFINITION — a Critical-severity reviewer finding
// is a false positive unless it FULL-matches a gold CRITICAL (same file, nearest
// gold within ±3 source lines, severity also Critical). A Critical that lands
// near a lower-tier gold (Important/Suggestion) is an OVER-ESCALATION and counts
// as an FP — calling a naming nit a runtime-Critical is exactly the precision
// regression this gate must catch. (The human baseline never over-escalates, so
// its FP is 0; a noisier engine must not slip through by spraying Criticals onto
// non-Critical gold lines.)
//
// ── THE LOAD-BEARING SCORER HAZARD (benchmark/gold-findings.json.line_coordinate_convention) ──
// Reviewers cite findings by the line number of the `+` line in the *diff text*
// (the .fixture file), e.g. `src/discount-engine.js:49`. Gold `line` fields are
// POST-IMAGE SOURCE lines (1-based within the resulting file), e.g. 25. Because
// the fixture is all whole-file additions, for each file:
//
//        source_line = cited_diff_line  -  hunkStartLine(file)
//
// where hunkStartLine(file) is the 1-based line number, *within the fixture
// text*, of that file's `@@ -0,0 +1,N @@` header. We MUST normalize every
// reviewer-cited line into post-image source space BEFORE the ±3 match. A naive
// raw-number compare floors Critical-recall at 0.0 for every run and makes the
// gate meaningless. (The P0 baseline scorer reconciled this by hand; this
// automated scorer bakes it in. Verified: 49-24=25, 98-81=17, 141-128=13.)
//
// The scorer ALSO runs a SHADOW match interpreting cited lines as already-source
// coordinates. If the shadow catches strictly more Criticals than the contract
// (diff-text) match, the transcript almost certainly used the wrong citation
// convention — the run is flagged `coordinate_warning` so a FAIL is not silently
// mistaken for an engine regression. The VERDICT always uses the contract match.
//
// This file IS the scorer, so it MAY read gold-findings.json. REVIEWERS may not.
//
// Zero-dep: node:fs / node:path / node:url only. Pure functions are exported for
// the test (run-no-regression-eval.test.mjs); a thin CLI wraps them.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH_DIR = join(HERE, 'benchmark');
const GOLD_PATH = join(BENCH_DIR, 'gold-findings.json');
const FIXTURE_PATH = join(BENCH_DIR, 'task-diff.fixture');
const BASELINE_PATH = join(BENCH_DIR, 'baseline.json');
const BASELINE_TRANSCRIPTS_DIR = join(BENCH_DIR, 'baseline-transcripts');

export const MATCH_TOLERANCE = 3; // ±3 source lines, per gold matching_hint.
const TIERS = Object.freeze(['critical', 'important', 'suggestion']);
const GATE_NOTE =
  'Objective half only. The binding M1->M2 gate ALSO requires N>=3 LIVE witnessed ' +
  'runs + the formal security Tier-2 + Tomer sign-off (design §12, §14 #3).';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture → per-file hunk map. The ONLY source of the normalization offsets.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the unified-diff fixture into { '<file>': { hunkStartLine, fileLength } }.
 * hunkStartLine = the 1-based fixture-text line number of that file's `@@` header.
 */
export function parseFixtureHunkMap(fixtureText) {
  const map = {};
  const lines = fixtureText.split('\n');
  let currentFile = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const plus = line.match(/^\+\+\+ b\/(.+)$/);
    if (plus) {
      currentFile = plus[1].trim();
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && currentFile) {
      const postStart = Number(hunk[1]); // first post-image line of the hunk (1 for whole-file adds)
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      // The first `+` content line is at fixture line (i+2) and equals post-image
      // line `postStart`, so source = cited - ((i+1) - postStart + 1). For
      // postStart===1 this is source = cited - (i+1) (the `@@` header line).
      const hunkStartLine = (i + 1) - postStart + 1;
      map[currentFile] = { hunkStartLine, fileLength: count };
      currentFile = null; // one hunk per file in this fixture
    }
  }
  return map;
}

/** Normalize a reviewer-cited diff-text line into post-image source space. */
export function normalizeLine(citedLine, file, hunkMap) {
  const h = hunkMap[file];
  if (!h || !Number.isFinite(citedLine)) return null;
  return citedLine - h.hunkStartLine;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold + baseline loading.
// ─────────────────────────────────────────────────────────────────────────────

export function loadGold(goldPath = GOLD_PATH) {
  const gold = JSON.parse(readFileSync(goldPath, 'utf8'));
  const defects = gold.defects.map((d) => ({
    id: d.id,
    file: d.file,
    line: Number(d.line),
    severity: String(d.severity).toLowerCase(),
  }));
  return {
    defects,
    criticalCount: defects.filter((d) => d.severity === 'critical').length,
  };
}

export function loadBaseline(baselinePath = BASELINE_PATH) {
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function baselineWorstFp(baseline) {
  return Math.max(0, ...((baseline.per_run ?? []).map((r) => r.false_positives ?? 0)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript parsing. A "run" is a list of { file, citedLine, severity }.
// Supports THREE shapes so the scorer reads whatever the live capture produced:
//   1. JSON findings array (the recommended canonical capture);
//   2. the markdown pipe-table (the committed baseline-transcripts shape);
//   3. the engine's NATIVE reviewer blocks: `### [<tier>] …` + `**Location:**
//      <file>:<line>` (prompts/doc-reviewer.md / workflow/lib/parse-findings.mjs).
// The scorer NEVER trusts a pre-computed "Source line" column — it always
// re-derives source from the cited diff-text line.
// ─────────────────────────────────────────────────────────────────────────────

function tierFromSeverity(sev) {
  const s = String(sev).trim().toLowerCase();
  return TIERS.includes(s) ? s : null;
}

/** Parse the `| # | File | Line (cited) | Source line | Severity | Summary |` table. */
export function parseTranscriptMarkdown(md) {
  const lines = md.split('\n');
  const findings = [];
  let cols = null; // { file, cited, severity } header indices
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      if (cols && findings.length) break; // table ended after we started reading rows
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue; // separator row
    if (!cols) {
      // header row — locate columns by name
      const lower = cells.map((c) => c.toLowerCase());
      const fileIdx = lower.findIndex((c) => c === 'file' || c.includes('file'));
      let citedIdx = lower.findIndex((c) => c.includes('cited'));
      if (citedIdx === -1) {
        citedIdx = lower.findIndex((c) => c.includes('line') && !c.includes('source'));
      }
      const sevIdx = lower.findIndex((c) => c.includes('sever'));
      if (fileIdx !== -1 && citedIdx !== -1 && sevIdx !== -1) {
        cols = { file: fileIdx, cited: citedIdx, severity: sevIdx };
      }
      continue;
    }
    // data row
    const file = cells[cols.file];
    const citedRaw = cells[cols.cited];
    const severity = tierFromSeverity(cells[cols.severity]);
    const citedLine = parseInt(String(citedRaw).replace(/[^0-9-]/g, ''), 10);
    if (file && severity && Number.isFinite(citedLine)) {
      findings.push({ file, citedLine, severity });
    }
  }
  return findings;
}

/**
 * Parse the engine's native reviewer-block format. Mirrors the documented
 * grammar in prompts/doc-reviewer.md and workflow/lib/parse-findings.mjs
 * (reimplemented independently — a trust gate must not depend on the
 * artifact-under-test's own parser to read its output). A `### [tier]` whose
 * `**Location:**` omits a line, or a malformed block, is skipped (it cannot be
 * source-matched anyway).
 */
export function parseFindingBlocks(md) {
  const findings = [];
  const headingRe = /^###\s+\[(critical|important|suggestion)\]/gim;
  const heads = [];
  let m;
  while ((m = headingRe.exec(md)) !== null) heads.push({ index: m.index, tag: m[1].toLowerCase() });
  for (let i = 0; i < heads.length; i++) {
    const block = md.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : md.length);
    const conf = block.match(/\*\*Confidence:\*\*\s*(\d+)/i);
    const score = conf ? Number(conf[1]) : null;
    const loc = block.match(/\*\*Location:\*\*\s*(.+)/i);
    let file = '';
    let citedLine = NaN;
    if (loc) {
      const fl = loc[1].trim().match(/^(.+?):(\d+)\s*$/);
      if (fl) {
        file = fl[1].trim();
        citedLine = Number(fl[2]);
      }
    }
    // explicit tier tag wins; fall back to score-derived (mirrors the engine).
    let severity = heads[i].tag;
    if (!TIERS.includes(severity)) {
      severity = Number.isFinite(score) ? (score >= 90 ? 'critical' : score >= 80 ? 'important' : 'suggestion') : null;
    }
    if (file && severity && Number.isFinite(citedLine)) findings.push({ file, citedLine, severity });
  }
  return findings;
}

/** Parse a JSON findings array (or {findings:[...]}). Throws on malformed JSON. */
export function parseFindingsJson(text) {
  const data = JSON.parse(text); // caller catches SyntaxError and reports it as a run error
  const arr = Array.isArray(data) ? data : Array.isArray(data?.findings) ? data.findings : [];
  const out = [];
  for (const f of arr) {
    const file = String(f.file ?? f.path ?? '').trim();
    const citedLine = Number(f.line ?? f.citedLine ?? f.lineNumber);
    let severity = tierFromSeverity(f.severity ?? f.tier);
    if (!severity && Number.isFinite(Number(f.score))) {
      const sc = Number(f.score);
      severity = sc >= 90 ? 'critical' : sc >= 80 ? 'important' : 'suggestion';
    }
    if (file && severity && Number.isFinite(citedLine)) out.push({ file, citedLine, severity });
  }
  return out;
}

/** Dispatch on extension/content: JSON → table → engine blocks. */
export function parseRunFindings(text, hint = '') {
  const trimmed = text.trim();
  if (hint === '.json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseFindingsJson(text);
  }
  const table = parseTranscriptMarkdown(text);
  if (table.length) return table;
  return parseFindingBlocks(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching. `sourceOf(finding)` maps a finding to a post-image source line.
// ─────────────────────────────────────────────────────────────────────────────

function nearestWithin(candidates, source) {
  let best = null;
  let bestDist = Infinity;
  for (const g of candidates) {
    const dist = Math.abs(g.line - source);
    if (dist <= MATCH_TOLERANCE && dist < bestDist) {
      best = g;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Match a run's findings to gold under a given source-line interpretation.
 * Returns { caughtCriticals, criticalFalsePositives, partials, reportedCriticals, caughtIds }.
 * A Critical finding is a FP unless it FULL-matches (same-tier) a gold Critical.
 */
function matchFindings(findings, gold, sourceOf) {
  const caught = new Set();
  const partials = [];
  let criticalFalsePositives = 0;
  let reportedCriticals = 0;

  for (const f of findings) {
    if (f.severity === 'critical') reportedCriticals++;
    const source = sourceOf(f);
    if (source === null || !Number.isFinite(source)) {
      if (f.severity === 'critical') criticalFalsePositives++; // can't be a real catch
      continue;
    }
    const sameFile = gold.defects.filter((g) => g.file === f.file);
    const sameTierGold = nearestWithin(sameFile.filter((g) => g.severity === f.severity), source);
    if (sameTierGold) {
      caught.add(sameTierGold.id); // FULL match (idempotent across duplicates)
      continue;
    }
    // No same-tier gold within tolerance.
    const nearestAnyTier = nearestWithin(sameFile, source);
    if (nearestAnyTier) {
      partials.push({ findingFile: f.file, source, goldId: nearestAnyTier.id, reviewerTier: f.severity, goldTier: nearestAnyTier.severity });
    }
    // A Critical with NO Critical gold nearby is a false / over-escalated Critical.
    if (f.severity === 'critical') criticalFalsePositives++;
  }

  const caughtCriticals = gold.defects.filter((g) => g.severity === 'critical' && caught.has(g.id)).length;
  return { caught, caughtCriticals, criticalFalsePositives, partials, reportedCriticals };
}

/** Score one run's findings against gold (verdict uses the diff-text contract match). */
export function scoreRun(findings, gold, hunkMap) {
  const diffText = (f) => normalizeLine(f.citedLine, f.file, hunkMap);
  // Shadow: interpret the cited line as an already-post-image source line, but
  // only for files we know (so an unknown file is still null, not a free match).
  const asSource = (f) => (hunkMap[f.file] && Number.isFinite(f.citedLine) ? f.citedLine : null);

  const primary = matchFindings(findings, gold, diffText);
  const shadow = matchFindings(findings, gold, asSource);

  const criticalRecall = gold.criticalCount === 0 ? 1 : primary.caughtCriticals / gold.criticalCount;

  return {
    critical_recall: criticalRecall,
    caught_criticals: primary.caughtCriticals,
    missed_criticals: gold.criticalCount - primary.caughtCriticals,
    false_positives: primary.criticalFalsePositives,
    false_clean: primary.reportedCriticals === 0, // reported the diff "clean" of Criticals
    caught_ids: [...primary.caught].sort(),
    partials: primary.partials,
    // Diagnostic: the cited-as-source interpretation caught strictly more
    // Criticals → the transcript likely used the wrong citation convention.
    coordinate_warning: shadow.caughtCriticals > primary.caughtCriticals,
    shadow_caught_criticals: shadow.caughtCriticals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate N runs and decide the gate vs baseline.
// ─────────────────────────────────────────────────────────────────────────────

export function aggregate(runResults, baseline) {
  const base = {
    n_runs: runResults.length,
    baseline_worst_run_critical_recall: baseline.worst_run_critical_recall,
    baseline_worst_run_false_positives: baselineWorstFp(baseline),
    runResults,
    note: GATE_NOTE,
  };
  if (runResults.length === 0) {
    return {
      ...base,
      pass: false,
      worst_run_critical_recall: 0,
      worst_run_index: -1,
      worst_run_false_positives: 0,
      any_false_clean: false,
      checks: { recallOk: false, cleanOk: false, precisionOk: false },
      reasons: ['no runs supplied'],
      warnings: [],
    };
  }

  let worstRecall = Infinity;
  let worstRecallIndex = -1;
  let worstFp = 0;
  let anyFalseClean = false;
  const warnings = [];
  const errorReasons = [];
  runResults.forEach((r, i) => {
    const tag = r.file ?? `run ${i + 1}`;
    if (r.error) errorReasons.push(`${tag}: ${r.error}`);
    if (r.findings_parsed === 0 && !r.error) warnings.push(`${tag}: parsed 0 findings — verify the capture format (JSON / table / "### [tier]" blocks); scored as false-clean`);
    if (r.coordinate_warning) warnings.push(`${tag}: cited-as-source would catch more Criticals (${r.shadow_caught_criticals} vs ${r.caught_criticals}) — likely a citation-convention mismatch, not necessarily an engine regression`);
    if (r.critical_recall < worstRecall) {
      worstRecall = r.critical_recall;
      worstRecallIndex = i;
    }
    if (r.false_positives > worstFp) worstFp = r.false_positives;
    if (r.false_clean) anyFalseClean = true;
  });

  const baselineWorstRecall = baseline.worst_run_critical_recall;
  const bwFp = baselineWorstFp(baseline);
  const recallOk = worstRecall >= baselineWorstRecall;
  const cleanOk = !anyFalseClean;
  const precisionOk = worstFp <= bwFp;
  const noErrors = errorReasons.length === 0;
  const pass = recallOk && cleanOk && precisionOk && noErrors;

  const reasons = [...errorReasons];
  if (!recallOk) reasons.push(`worst-run Critical-recall ${fmt(worstRecall)} < baseline ${fmt(baselineWorstRecall)}`);
  if (!cleanOk) reasons.push('at least one run reported the diff clean of Criticals (skip-if-clean / false-clean)');
  if (!precisionOk) reasons.push(`worst-run critical false-positives ${worstFp} > baseline ${bwFp} (precision regressed / over-escalation)`);

  return {
    ...base,
    pass,
    worst_run_critical_recall: worstRecall,
    worst_run_index: worstRecallIndex,
    worst_run_false_positives: worstFp,
    any_false_clean: anyFalseClean,
    checks: { recallOk, cleanOk, precisionOk, noErrors },
    reasons,
    warnings,
  };
}

function fmt(x) {
  return (Math.round(x * 10000) / 10000).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level helpers.
// ─────────────────────────────────────────────────────────────────────────────

export function scoreRunFromText(text, { gold, hunkMap }, hint = '') {
  const findings = parseRunFindings(text, hint);
  return { ...scoreRun(findings, gold, hunkMap), findings_parsed: findings.length };
}

/** Score the three committed baseline transcripts — the Tier-1 offline self-test. */
export function scoreBaselineTranscripts({
  gold = loadGold(),
  hunkMap = parseFixtureHunkMap(readFileSync(FIXTURE_PATH, 'utf8')),
  dir = BASELINE_TRANSCRIPTS_DIR,
} = {}) {
  const files = readdirSync(dir)
    .filter((f) => /^run-\d+\.md$/.test(f))
    .sort();
  return files.map((f) => ({
    file: f,
    ...scoreRunFromText(readFileSync(join(dir, f), 'utf8'), { gold, hunkMap }, '.md'),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: `node run-no-regression-eval.mjs [run-file|dir ...]`
//   no args  → self-test: score committed baseline transcripts, verify vs baseline.json.
//   args     → score the supplied run transcript(s), aggregate, gate vs baseline.json.
// Exit 0 = PASS, 1 = FAIL, 2 = usage/IO error.
// ─────────────────────────────────────────────────────────────────────────────

function collectRunFiles(paths) {
  const out = [];
  for (const p of paths) {
    if (!existsSync(p)) {
      console.error(`run path not found: ${p}`);
      process.exit(2);
    }
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) {
        if (/\.(md|json)$/.test(f)) out.push(join(p, f));
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

/** Load + score one run file; a parse/read failure becomes an explicit error result (never a crash). */
function scoreRunFile(file, ctx) {
  try {
    const text = readFileSync(file, 'utf8');
    return { file, ...scoreRunFromText(text, ctx, extname(file)) };
  } catch (e) {
    return {
      file,
      error: `could not read/parse run (${e.message})`,
      critical_recall: 0,
      caught_criticals: 0,
      missed_criticals: ctx.gold.criticalCount,
      false_positives: 0,
      false_clean: true,
      caught_ids: [],
      partials: [],
      coordinate_warning: false,
      shadow_caught_criticals: 0,
      findings_parsed: 0,
    };
  }
}

function main(argv) {
  const args = argv.slice(2);
  const gold = loadGold();
  const hunkMap = parseFixtureHunkMap(readFileSync(FIXTURE_PATH, 'utf8'));
  const baseline = loadBaseline();
  const ctx = { gold, hunkMap };

  let runResults;
  let mode;
  if (args.length === 0) {
    mode = 'self-test (committed baseline transcripts)';
    runResults = scoreBaselineTranscripts({ gold, hunkMap });
  } else {
    mode = 'live runs';
    runResults = collectRunFiles(args).map((f) => scoreRunFile(f, ctx));
  }

  const verdict = aggregate(runResults, baseline);
  console.log(`no-regression eval — ${mode}`);
  for (const r of runResults) {
    if (r.error) {
      console.log(`  ${r.file ?? '(run)'}: ERROR — ${r.error}`);
      continue;
    }
    console.log(
      `  ${r.file ?? '(run)'}: recall=${fmt(r.critical_recall)} ` +
        `(${r.caught_criticals}/${gold.criticalCount}) fp=${r.false_positives} ` +
        `${r.false_clean ? 'FALSE-CLEAN ' : ''}caught=[${r.caught_ids.join(',')}]`,
    );
  }
  for (const w of verdict.warnings ?? []) console.log(`  ⚠ ${w}`);
  console.log(
    `verdict: ${verdict.pass ? 'PASS' : 'FAIL'} — worst recall ${fmt(verdict.worst_run_critical_recall)} ` +
      `vs baseline ${fmt(verdict.baseline_worst_run_critical_recall)}, worst fp ${verdict.worst_run_false_positives} ` +
      `vs baseline ${verdict.baseline_worst_run_false_positives}`,
  );
  if (!verdict.pass) for (const why of verdict.reasons) console.log(`  ✗ ${why}`);
  console.log(`note: ${verdict.note}`);

  // In self-test mode, additionally assert we reproduce baseline.json (the Tier-1 gate).
  if (args.length === 0) {
    const mismatches = [];
    baseline.per_run.forEach((b, i) => {
      const r = runResults[i];
      if (!r) { mismatches.push(`run ${i + 1}: no computed result`); return; }
      if (Math.abs(r.critical_recall - b.critical_recall) > 1e-9)
        mismatches.push(`run ${i + 1}: recall ${fmt(r.critical_recall)} != baseline ${fmt(b.critical_recall)}`);
      if (r.false_positives !== b.false_positives)
        mismatches.push(`run ${i + 1}: fp ${r.false_positives} != baseline ${b.false_positives}`);
    });
    if (runResults.length !== baseline.per_run.length)
      mismatches.push(`run count ${runResults.length} != baseline ${baseline.per_run.length}`);
    if (mismatches.length) {
      console.error('SELF-TEST FAILED — scorer does not reproduce baseline.json:');
      for (const m of mismatches) console.error(`  ✗ ${m}`);
      process.exit(1);
    }
    console.log('self-test: scorer reproduces baseline.json ✓');
  }

  process.exit(verdict.pass ? 0 : 1);
}

// Run as CLI only when executed directly (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
