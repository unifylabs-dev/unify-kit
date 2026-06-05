// build-workflow.mjs — the DETERMINISTIC bundler for the phasing-flow execution
// Workflow (M2 D1).
//
// THE CONSTRAINT (VERIFIED, ADR 0003): a Workflow-runtime script CANNOT import
// modules — no dynamic and no static import; it runs in a sandboxed VM with no
// module resolver. So the tested kernel (lib/*.mjs + unit-cursor.mjs +
// verify-verdict.mjs + execution-engine.mjs + wrapper.mjs) and the agent-backed
// glue (src/glue.mjs) must be INLINED into ONE self-contained script. This
// bundler does that inlining, and a CI parity step (`node build-workflow.mjs`
// then `git diff --exit-code <bundle>`) proves the committed bundle never drifts
// from a fresh regeneration.
//
// DETERMINISM CONTRACT:
//   - Fixed, hand-authored dependency ORDER (SOURCES below). No fs-listing whose
//     order could vary across platforms.
//   - No timestamps, no random, no wall-clock — the only inputs are the source
//     file CONTENTS, so identical sources => byte-identical output. Idempotent.
//   - `export const meta = {...}` is emitted FIRST (the Workflow tool reads it
//     before executing). Every other source's `import`/`export` is stripped so
//     there is exactly ONE declaration of each symbol and ZERO import statements.
//
// Run:  node build-workflow.mjs   (writes phasing-flow-engine.workflow.mjs)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUNDLE_PATH = join(__dirname, 'phasing-flow-engine.workflow.mjs');

// Dependency order: every module appears AFTER the modules it depends on, so a
// concatenation with imports stripped resolves top-to-bottom with no forward
// references at module-eval time. (Function bodies may reference later-defined
// functions; only top-level const/usage ordering matters, and the SOURCES order
// respects it.)
//
//   exit-reasons        (no deps)
//   clamp               (no deps)
//   canonical           (no deps)                          [consensus-aggregate dep]
//   make-return         (needs exit-reasons: assertExitReason)
//   budget-guard        (no deps)
//   verifier-detect     (no deps)                          [glue verify path]
//   consensus-aggregate (needs canonical)                  [glue diff-review]
//   verify-verdict      (needs exit-reasons)               [M2 engine kernel]
//   execution-engine    (needs clamp/budget-guard/make-return/exit-reasons/verify-verdict)
//   wrapper             (needs execution-engine)
//   src/glue            (needs wrapper + verifier-detect + consensus-aggregate)
//
// NOTE: fixed-point.mjs + unit-cursor.mjs are intentionally ABSENT — M2's serial
// loop cannot stall, so a fixed-point ceiling is premature (P-A review); M3
// (parallel fan-out / retries) reintroduces a stall guard.
const SOURCES = [
  'lib/exit-reasons.mjs',
  'lib/clamp.mjs',
  'lib/canonical.mjs',
  'lib/make-return.mjs',
  'lib/budget-guard.mjs',
  'lib/verifier-detect.mjs',
  'lib/consensus-aggregate.mjs',
  'verify-verdict.mjs',
  'execution-engine.mjs',
  'wrapper.mjs',
  'src/glue.mjs',
];

// ---------------------------------------------------------------------------
// Import / export stripping.
// ---------------------------------------------------------------------------

/**
 * Remove every `import ... from '...';` statement (single- AND multi-line) from
 * a source string. We do this line-wise with a small state machine: a line that
 * starts an import begins a skip that continues until the line that ends with a
 * `;` (covers the multi-line `import {\n a,\n b,\n} from '...';` form).
 *
 * Bare `import 'x';` (side-effect import) and `import x from 'x';` are also
 * covered — any line whose first token is `import`.
 * @param {string[]} lines
 * @returns {string[]}
 */
function stripImports(lines) {
  const out = [];
  let inImport = false;
  for (const line of lines) {
    if (!inImport && /^\s*import\b/.test(line)) {
      // Single-line import ends on the same line (terminating `;` or a `from
      // '...'` clause ending in `;`). A multi-line import opens a brace that is
      // not yet closed on this line.
      if (/;\s*$/.test(line)) {
        // single-line import — drop it entirely.
        continue;
      }
      inImport = true; // multi-line import opened — keep skipping.
      continue;
    }
    if (inImport) {
      // Skip until the statement terminates with a `;`.
      if (/;\s*$/.test(line)) inImport = false;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Strip the `export ` keyword from declaration lines and DROP bare re-export
 * statements (`export { X };`) whose symbol is already declared in scope after
 * inlining.
 *
 *   `export function f(`   -> `function f(`
 *   `export const X `      -> `const X `
 *   `export async function`-> `async function`
 *   `export default ...`   -> dropped (none in our sources; guard anyway)
 *   `export { a, b };`     -> dropped (symbols already defined inline)
 *   `export { a } from '..';` -> already removed by stripImports (has `from`)
 * @param {string[]} lines
 * @returns {string[]}
 */
function stripExports(lines) {
  const out = [];
  for (const line of lines) {
    // Bare re-export of already-defined symbols: `export { ... };` with NO
    // `from` clause. Drop the whole line.
    if (/^\s*export\s*\{[^}]*\}\s*;\s*$/.test(line)) {
      continue;
    }
    // `export default` — drop the keyword pair (we have none, but be safe).
    if (/^\s*export\s+default\b/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+default\s+/, '$1'));
      continue;
    }
    // Declaration export: strip just the leading `export ` keyword.
    if (/^\s*export\s+/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Extract the `export const meta = {...};` block from the glue source so it can
 * be emitted FIRST. Returns { metaBlock, rest } where `rest` is the glue with
 * the meta block removed (and the leading `export ` already handled). The meta
 * literal is brace-balanced; we scan from the `export const meta` line until the
 * matching close brace + `;`.
 * @param {string} glueSrc
 * @returns {{ metaBlock: string, rest: string }}
 */
function extractMeta(glueSrc) {
  const lines = glueSrc.split('\n');
  const startIdx = lines.findIndex((l) => /^\s*export\s+const\s+meta\s*=/.test(l));
  if (startIdx === -1) {
    throw new Error('build-workflow: src/glue.mjs is missing `export const meta = {`');
  }
  // Brace-balance scan from startIdx.
  let depth = 0;
  let endIdx = -1;
  let started = false;
  for (let i = startIdx; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth += 1;
        started = true;
      } else if (ch === '}') {
        depth -= 1;
      }
    }
    if (started && depth === 0) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new Error('build-workflow: could not brace-balance the meta literal');
  }
  const metaLines = lines.slice(startIdx, endIdx + 1);
  // Strip the leading `export ` from the meta declaration so the emitted-first
  // copy is a plain `const meta = {...}`; we re-export it explicitly at the end.
  metaLines[0] = metaLines[0].replace(/^(\s*)export\s+/, '$1');
  const metaBlock = metaLines.join('\n');

  const rest = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join('\n');
  return { metaBlock, rest };
}

// ---------------------------------------------------------------------------
// Build.
// ---------------------------------------------------------------------------

/**
 * Produce the bundle string from the SOURCES. Pure function of file contents.
 * @returns {string}
 */
export function buildBundle() {
  // Read + strip every source EXCEPT glue's meta, which we hoist to the top.
  const sections = [];
  let metaBlock = null;

  for (const rel of SOURCES) {
    const abs = join(__dirname, rel);
    let src = readFileSync(abs, 'utf8');

    if (rel === 'src/glue.mjs') {
      const extracted = extractMeta(src);
      metaBlock = extracted.metaBlock;
      src = extracted.rest;
    }

    let lines = src.split('\n');
    lines = stripImports(lines);
    lines = stripExports(lines);

    // Collapse leading/trailing blank lines per section so spacing is stable.
    let body = lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');

    sections.push(
      `// ===== inlined: ${rel} =====\n${body}`,
    );
  }

  if (metaBlock === null) {
    throw new Error('build-workflow: meta block was not extracted from glue');
  }

  const header = [
    '// phasing-flow-engine.workflow.mjs — GENERATED by build-workflow.mjs. DO NOT EDIT.',
    '//',
    '// This is the self-contained bundle the phasing-flow skill runs via the',
    '// Workflow tool (scriptPath). The Workflow VM cannot import modules, so the',
    '// tested kernel (lib/*.mjs + unit-cursor.mjs + verify-verdict.mjs +',
    '// execution-engine.mjs + wrapper.mjs) and the agent-backed glue (src/glue.mjs)',
    '// are INLINED here with imports stripped.',
    '//',
    '// Regenerate with: node build-workflow.mjs   (CI parity-guards this is fresh)',
    '// `export const meta` is FIRST; there are ZERO import statements below.',
  ].join('\n');

  const parts = [
    header,
    '',
    '// ===== workflow meta (hoisted first; see src/glue.mjs) =====',
    `export ${metaBlock}`,
    '',
    ...sections,
    '',
    '// ===== entrypoint (the runtime executes the body; there is NO exported-entry',
    '// auto-invocation — proven by probe wf_5ffc08f3-c30, ADR 0003). main() runs at',
    '// the top level and its return value IS the workflow result. The `args` global',
    '// arrives as a JSON string; main() parses it. This top-level `return` is why the',
    '// bundle is NOT node --check-clean as a bare module — the Workflow tool wraps the',
    '// body in an async function. CI validates it via check-bundle.mjs instead. =====',
    'return await main(typeof args !== "undefined" ? args : {});',
    '',
  ];

  // Single trailing newline, normalized — deterministic regardless of source
  // trailing-whitespace quirks.
  return `${parts.join('\n').replace(/\n+$/, '')}\n`;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function writeBundle() {
  const bundle = buildBundle();
  writeFileSync(BUNDLE_PATH, bundle, 'utf8');
  return bundle;
}

// Run when invoked directly (node build-workflow.mjs). Comparing the resolved
// module path to argv[1] keeps buildBundle() importable by a test without
// triggering the write side effect.
const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === selfPath) {
  writeBundle();
  process.stdout.write(`wrote ${BUNDLE_PATH}\n`);
}

export { writeBundle, BUNDLE_PATH };
