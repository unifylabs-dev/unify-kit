// parse-findings.mjs — pure raw-agent-output -> normalized findings (P3).
//
// The review agents emit findings either as the structured markdown block in
// prompts/doc-reviewer.md (### [Critical] <title> / **Confidence:** N/100 / ...)
// or, increasingly, as a JSON array. This module normalizes BOTH into the single
// shape the engine consumes:
//
//   { file, line, severity, score, description }
//
// where `severity` is one of 'critical' | 'important' | 'suggestion' and is
// derived per references/severity-policy.md:
//   - an explicit severity tag (the markdown '[Critical]' bracket or a JSON
//     `severity` field) WINS;
//   - otherwise the numeric score maps 90+ -> critical, 80-89 -> important,
//     <80 -> suggestion.
// This mirrors the engine's tierOf() exactly so the wrapper and engine agree on
// what tier a finding is.
//
// Determinism: pure string/array transform. No wall-clock, no random, no i/o.

const VALID_TIERS = new Set(['critical', 'important', 'suggestion']);

/**
 * Map a numeric score to a tier per severity-policy.md.
 * @param {number} score
 * @returns {'critical'|'important'|'suggestion'}
 */
function tierFromScore(score) {
  if (Number.isFinite(score)) {
    if (score >= 90) return 'critical';
    if (score >= 80) return 'important';
  }
  return 'suggestion';
}

/**
 * Resolve a finding's tier: explicit tag wins, else score-derived. An
 * unrecognized tag falls through to the score.
 * @param {string|undefined} tag
 * @param {number} score
 * @returns {'critical'|'important'|'suggestion'}
 */
function resolveTier(tag, score) {
  const t = String(tag ?? '').toLowerCase().trim();
  if (VALID_TIERS.has(t)) return t;
  return tierFromScore(score);
}

/**
 * Normalize a single object-form finding.
 * @param {object} f
 * @returns {{file:string,line:number|null,severity:string,score:number|null,description:string}}
 */
function normalizeOne(f) {
  const scoreNum = Number(f?.score ?? f?.confidence);
  const score = Number.isFinite(scoreNum) ? scoreNum : null;
  const severity = resolveTier(f?.severity, score);
  const lineNum = Number(f?.line);
  const line = Number.isFinite(lineNum) ? lineNum : null;
  return {
    file: String(f?.file ?? f?.location ?? ''),
    line,
    severity,
    score,
    description: String(f?.description ?? f?.title ?? f?.issue ?? ''),
  };
}

/**
 * Parse the markdown finding blocks from doc-reviewer.md's output format.
 * Each block starts with '### [<Tier>] <title>' and may carry
 * '**Confidence:** N/100' and '**Location:** <file>:<line>' lines.
 * @param {string} md
 * @returns {object[]}
 */
function parseMarkdown(md) {
  const findings = [];
  // Split on the finding-heading marker; keep the bracket+title with each chunk.
  const headingRe = /^###\s+\[(critical|important|suggestion)\]\s*(.*)$/gim;
  const matches = [];
  let m;
  while ((m = headingRe.exec(md)) !== null) {
    matches.push({ index: m.index, tag: m[1].toLowerCase(), title: m[2].trim() });
  }
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    const block = md.slice(start, end);

    const confMatch = block.match(/\*\*Confidence:\*\*\s*(\d+)/i);
    const score = confMatch ? Number(confMatch[1]) : null;

    const locMatch = block.match(/\*\*Location:\*\*\s*(.+)/i);
    let file = '';
    let line = null;
    if (locMatch) {
      const loc = locMatch[1].trim();
      const fileLine = loc.match(/^(.+?):(\d+)\s*$/);
      if (fileLine) {
        file = fileLine[1].trim();
        line = Number(fileLine[2]);
      } else {
        file = loc;
      }
    }

    const issueMatch = block.match(/\*\*Issue:\*\*\s*(.+)/i);
    const description = (issueMatch ? issueMatch[1] : matches[i].title).trim();

    findings.push({
      file,
      line,
      severity: resolveTier(matches[i].tag, score),
      score,
      description,
    });
  }
  return findings;
}

/**
 * Normalize raw agent output (a JSON array, a {findings:[...]} object, an
 * already-array of objects, or a markdown report) into the engine's finding
 * shape. Unparseable input yields an empty array (never throws) — an
 * unreadable review pass is treated as "no findings", which the skip-if-clean
 * gate then handles safely.
 * @param {string|object|Array} rawAgentOutput
 * @returns {Array<{file:string,line:number|null,severity:string,score:number|null,description:string}>}
 */
export function normalizeFindings(rawAgentOutput) {
  if (rawAgentOutput == null) return [];

  // Already an array of finding objects.
  if (Array.isArray(rawAgentOutput)) {
    return rawAgentOutput.map(normalizeOne);
  }

  // An object — either a wrapper {findings:[...]} or a single finding.
  if (typeof rawAgentOutput === 'object') {
    if (Array.isArray(rawAgentOutput.findings)) {
      return rawAgentOutput.findings.map(normalizeOne);
    }
    return [normalizeOne(rawAgentOutput)];
  }

  // A string — try JSON first, then fall back to markdown parsing.
  if (typeof rawAgentOutput === 'string') {
    const trimmed = rawAgentOutput.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeFindings(parsed);
      } catch {
        // fall through to markdown
      }
    }
    return parseMarkdown(trimmed);
  }

  return [];
}
