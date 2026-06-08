// build-workflow.mjs — the DETERMINISTIC bundler for the integrate-branch audit
// Workflow seed (M3 adoption, skill 1 of 3). Cloned from the phasing-flow engine
// bundler (RIG reuse, ADR 0003): identical inlining/stripping logic; ONLY the
// SOURCES list, the bundle name, the meta-source filename, and the header differ.
//
// THE CONSTRAINT (VERIFIED, ADR 0003): a Workflow-runtime script CANNOT import
// modules — it runs in a sandboxed VM with no module resolver. So the tested
// pure kernel (compute-audit.mjs + audit-aggregate.mjs) + the copied libs
// (lib/*.mjs) + the agent-backed glue (src/audit-glue.mjs) must be INLINED into
// ONE self-contained script. A CI parity step (`node build-workflow.mjs` then
// `git diff --exit-code <bundle>`) proves the committed bundle never drifts.
//
// DETERMINISM CONTRACT: fixed hand-authored dependency ORDER (SOURCES below); no
// timestamps/random/wall-clock — identical sources ⇒ byte-identical output.
// `export const meta` is emitted FIRST; every other import/export is stripped.
//
// Run:  node build-workflow.mjs   (writes integrate-audit.workflow.mjs)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUNDLE_PATH = join(__dirname, 'integrate-audit.workflow.mjs');
const GLUE_REL = 'src/audit-glue.mjs';

// Dependency order: every module appears AFTER the modules it depends on, so a
// concatenation with imports stripped resolves top-to-bottom.
//   canonical            (no deps)            [consensus-aggregate dep]
//   consensus-aggregate  (needs canonical)    [audit-aggregate D4]
//   verifier-detect      (no deps)            [audit-aggregate D2]
//   compute-audit        (no deps; PURE)      [the authoritative reduce]
//   audit-aggregate      (needs consensus-aggregate + verifier-detect)
//   src/audit-glue       (needs compute-audit + audit-aggregate; carries meta)
const SOURCES = [
  'lib/canonical.mjs',
  'lib/consensus-aggregate.mjs',
  'lib/verifier-detect.mjs',
  'compute-audit.mjs',
  'audit-aggregate.mjs',
  GLUE_REL,
];

// ---------------------------------------------------------------------------
// Import / export stripping (generic — verbatim from the engine bundler).
// ---------------------------------------------------------------------------

function stripImports(lines) {
  const out = [];
  let inImport = false;
  for (const line of lines) {
    if (!inImport && /^\s*import\b/.test(line)) {
      if (/;\s*$/.test(line)) {
        continue;
      }
      inImport = true;
      continue;
    }
    if (inImport) {
      if (/;\s*$/.test(line)) inImport = false;
      continue;
    }
    out.push(line);
  }
  return out;
}

function stripExports(lines) {
  const out = [];
  for (const line of lines) {
    if (/^\s*export\s*\{[^}]*\}\s*;\s*$/.test(line)) {
      continue;
    }
    if (/^\s*export\s+default\b/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+default\s+/, '$1'));
      continue;
    }
    if (/^\s*export\s+/.test(line)) {
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      continue;
    }
    out.push(line);
  }
  return out;
}

function extractMeta(glueSrc) {
  const lines = glueSrc.split('\n');
  const startIdx = lines.findIndex((l) => /^\s*export\s+const\s+meta\s*=/.test(l));
  if (startIdx === -1) {
    throw new Error(`build-workflow: ${GLUE_REL} is missing \`export const meta = {\``);
  }
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
  metaLines[0] = metaLines[0].replace(/^(\s*)export\s+/, '$1');
  const metaBlock = metaLines.join('\n');
  const rest = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join('\n');
  return { metaBlock, rest };
}

// ---------------------------------------------------------------------------
// Build.
// ---------------------------------------------------------------------------

export function buildBundle() {
  const sections = [];
  let metaBlock = null;

  for (const rel of SOURCES) {
    const abs = join(__dirname, rel);
    let src = readFileSync(abs, 'utf8');

    if (rel === GLUE_REL) {
      const extracted = extractMeta(src);
      metaBlock = extracted.metaBlock;
      src = extracted.rest;
    }

    let lines = src.split('\n');
    lines = stripImports(lines);
    lines = stripExports(lines);

    const body = lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');

    sections.push(`// ===== inlined: ${rel} =====\n${body}`);
  }

  if (metaBlock === null) {
    throw new Error('build-workflow: meta block was not extracted from glue');
  }

  const header = [
    '// integrate-audit.workflow.mjs — GENERATED by build-workflow.mjs. DO NOT EDIT.',
    '//',
    '// The self-contained bundle the integrate-branch skill runs via the Workflow',
    '// tool (scriptPath) for its Phase-2 audit. The Workflow VM cannot import',
    '// modules, so the tested kernel (compute-audit.mjs + audit-aggregate.mjs), the',
    '// copied libs (lib/*.mjs), and the agent-backed glue (src/audit-glue.mjs) are',
    '// INLINED here with imports stripped.',
    '//',
    '// Regenerate with: node build-workflow.mjs   (CI parity-guards this is fresh)',
    '// `export const meta` is FIRST; there are ZERO import statements below.',
  ].join('\n');

  const parts = [
    header,
    '',
    '// ===== workflow meta (hoisted first; see src/audit-glue.mjs) =====',
    `export ${metaBlock}`,
    '',
    ...sections,
    '',
    '// ===== entrypoint (the runtime executes the body; there is NO exported-entry',
    '// auto-invocation — ADR 0003). main() runs at the top level and its return',
    '// value IS the workflow result. The `args` global arrives as a JSON string;',
    '// main() parses it. This top-level `return` is why the bundle is NOT',
    '// node --check-clean as a bare module — the Workflow tool wraps the body in an',
    '// async function. CI validates it via check-bundle.mjs instead. =====',
    'return await main(typeof args !== "undefined" ? args : {});',
    '',
  ];

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

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === selfPath) {
  writeBundle();
  process.stdout.write(`wrote ${BUNDLE_PATH}\n`);
}

export { writeBundle, BUNDLE_PATH };
