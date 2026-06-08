// mode-detect.mjs — pure mode resolution (P3 wrapper foundation).
//
// Encodes references/modes.md's detection tree for the SUBSET that is decidable
// from the target string alone: doc vs code. (phase mode and the PR/no-arg
// AskUserQuestion branches need runtime probes — gh, fs, git — so they are NOT
// resolved here; the agent-backed glue handles those before calling the wrapper,
// or passes an explicit `mode`.)
//
// detectMode(target) returns 'doc' | 'code'. Rules, first match wins:
//   1. Arg starts with 'phase' token -> 'phase' is NOT pure-decidable; we still
//      classify the literal 'phase ...' string as 'phase' so a caller that DID
//      resolve a phasing run can pass the raw arg through and get the right tag.
//   2. Doc extensions (.md / .txt / .rst / .mdx) -> 'doc'.
//   3. Path under a doc-ish root (specs/ / docs/ / plans/) -> 'doc'.
//   4. Otherwise -> 'code' (PR number, code file, local diff).
//
// Determinism: pure string inspection. No wall-clock, no random, no i/o.

const DOC_EXTENSIONS = ['.md', '.txt', '.rst', '.mdx'];
const DOC_ROOTS = ['specs/', 'docs/', 'plans/'];

/**
 * Lowercased file extension including the dot, or '' when none.
 * @param {string} p
 * @returns {string}
 */
function extensionOf(p) {
  const base = String(p).split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return ''; // no dot, or dotfile like '.gitignore'
  return base.slice(dot).toLowerCase();
}

/**
 * Resolve the review mode from the target string.
 * @param {string} target
 * @returns {'phase'|'doc'|'code'}
 */
export function detectMode(target) {
  const t = String(target ?? '').trim();

  // (1) explicit phasing arg — 'phase <run-id> <N>'. First token === 'phase'.
  const firstToken = t.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (firstToken === 'phase') return 'phase';

  // Normalize for path-shape checks: strip a leading './'.
  const norm = t.replace(/^\.\//, '');

  // (2) doc by extension.
  const ext = extensionOf(norm);
  if (DOC_EXTENSIONS.includes(ext)) return 'doc';

  // (3) doc by root directory. Match a path segment boundary so 'mydocs/' does
  // not count but 'docs/' and 'a/docs/b' do.
  const withLeadingSlash = `/${norm}`;
  for (const root of DOC_ROOTS) {
    if (norm.startsWith(root) || withLeadingSlash.includes(`/${root}`)) {
      return 'doc';
    }
  }

  // (4) everything else is code: a PR number, a code file, a local diff.
  return 'code';
}
