#!/usr/bin/env node
// check-bundle.mjs — validate the generated review-changed-files.workflow.mjs the
// way the Workflow tool actually runs it.
//
// WHY NOT `node --check`: the committed bundle ends with a top-level `return await
// main(args)` (ADR 0003: the runtime executes the script BODY — there is no
// exported-entry auto-invocation — and the top-level return is the workflow
// result). A top-level `return` is NOT legal in a bare ESM module, so
// `node --check <bundle>` raises "Illegal return statement" on the CORRECT bundle.
// The Workflow tool extracts `export const meta` and wraps the rest in an async
// function, where top-level await + return ARE legal. This validator mirrors that:
// it wrap-parses the body as an async function body and asserts the structural
// invariants the runtime + the no-imports rule require.
//
// Zero-dep: node:fs only. Exit 0 = valid, 1 = invalid.

import { readFileSync } from 'node:fs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const RUNTIME_GLOBALS = ['agent', 'parallel', 'phase', 'log', 'args', 'budget'];

function fail(msg) {
  console.error(`check-bundle: FAIL — ${msg}`);
  process.exit(1);
}

// Extract the `export const meta = {...}` literal block by brace-balancing from
// the declaration line to its matching close brace.
function extractMetaBlock(text) {
  const ls = text.split('\n');
  const start = ls.findIndex((l) => /^\s*export\s+const\s+meta\s*=/.test(l));
  if (start === -1) return null;
  let depth = 0;
  let started = false;
  for (let i = start; i < ls.length; i += 1) {
    for (const ch of ls[i]) {
      if (ch === '{') { depth += 1; started = true; } else if (ch === '}') { depth -= 1; }
    }
    if (started && depth === 0) return ls.slice(start, i + 1).join('\n');
  }
  return null;
}

const path = process.argv[2];
if (!path) fail('usage: node check-bundle.mjs <bundle.mjs>');

const src = readFileSync(path, 'utf8');
const lines = src.split('\n');

// (1) ZERO import statements — the Workflow VM cannot resolve modules.
const importLines = lines.filter((l) => /^\s*import\b/.test(l));
if (importLines.length > 0) fail(`bundle contains ${importLines.length} import statement(s) — the Workflow VM cannot import`);

// (2) Exactly one `export`, and it is `export const meta` (the tool reads meta,
//     then wraps the rest; any other top-level export would be illegal inside the
//     wrapped async function body).
const exportLines = lines.filter((l) => /^\s*export\b/.test(l));
if (exportLines.length !== 1) fail(`expected exactly 1 export line (export const meta); found ${exportLines.length}: ${JSON.stringify(exportLines)}`);
if (!/^\s*export\s+const\s+meta\s*=/.test(exportLines[0])) fail(`the sole export must be \`export const meta = ...\`; got: ${exportLines[0]}`);

// (3) meta must be a PURE LITERAL — the Workflow tool AST-rejects any non-literal
//     node (variable, call, spread, template, or string CONCATENATION) in meta and
//     refuses to run the script. CI cannot run the tool, so approximate the check
//     statically: strip string-literal contents from the meta block, then any
//     residual `+` / backtick / `...` / `(` is a non-literal construct.
const metaBlock = extractMetaBlock(src);
if (!metaBlock) fail('could not locate the `export const meta = {...}` block');
const metaResidue = metaBlock
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""');
const impure = [
  { re: /`/, why: 'template literal' },
  { re: /\.\.\./, why: 'spread' },
  { re: /\+/, why: 'string concatenation / arithmetic (use one literal string)' },
  { re: /\(/, why: 'function call' },
].find((p) => p.re.test(metaResidue));
if (impure) fail(`meta is not a pure literal (found ${impure.why}) — the Workflow tool requires a pure-literal meta`);

// (4) A top-level entrypoint invocation must be present — the body must actually
//     CALL the orchestration (a phantom bundle that exported main but never ran it
//     was the original failure class).
if (!/\breturn\s+await\s+main\s*\(/.test(src) && !/^\s*await\s+main\s*\(/m.test(src)) {
  fail('no top-level `return await main(...)` / `await main(...)` entrypoint — the body must invoke the workflow');
}

// (5) The body must PARSE the way the runtime runs it: strip the `export` keyword
//     from the meta declaration (so meta is a plain const) and wrap-parse the whole
//     file as an async function body. Top-level await + return + const all parse
//     here; a real syntax error throws.
const asBody = src.replace(/^(\s*)export\s+const\s+meta\b/m, '$1const meta');
try {
  // Construct (parse) only — never invoked. Runtime globals are bound as params.
  new AsyncFunction(...RUNTIME_GLOBALS, asBody);
} catch (e) {
  fail(`bundle body does not parse as an async function body (the runtime shape): ${e.message}`);
}

console.log('check-bundle: OK — import-free, meta-first, entrypoint present, parses as the runtime runs it');
