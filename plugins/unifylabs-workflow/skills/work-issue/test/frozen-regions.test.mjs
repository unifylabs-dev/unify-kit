// frozen-regions.test.mjs — content-anchored guard that the M3 phasing-flow rewire
// (and any future edit) keeps the genuinely-untouched work-issue SKILL.md blocks
// BYTE-VERBATIM. The M3 wiring deliberately changes only four regions: the
// invocation/flags preamble (the --phase/--no-phase flags removed + a migration
// note), Phase 3 (the planning-brain seed pointer), Phase 4 (the execution-engine
// seed pointer), and the DELETION of Phase 3.5. Everything else is the skill's
// no-regression identity and is frozen here.
//
// CONTENT-ANCHORED (mirrors integrate-branch/workflow/test/frozen-regions.test.mjs):
// each block is sliced between exact heading STRINGS — immune to line-number drift
// from edits elsewhere. Goldens were captured from the pre-rewire SKILL.md (P3) and
// re-verified byte-identical against the post-rewire file before this test landed.
//
// RED-capable (gate-the-gate): a drifted golden OR a perturbed frozen block turns a
// byte-identity test red; a removed pointer / re-introduced Phase 3.5 turns a
// landed-rewire test red. The CI harness exercises this by mutating a golden and
// asserting the suite fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(__dirname, '../SKILL.md'), 'utf8');

function block(startHeading, endHeading) {
  const a = SKILL.indexOf(startHeading);
  assert.notEqual(a, -1, `frozen-region start anchor not found: ${startHeading}`);
  const b = SKILL.indexOf(endHeading, a + startHeading.length);
  assert.notEqual(b, -1, `frozen-region end anchor not found: ${endHeading}`);
  return SKILL.slice(a, b);
}

// [golden-name, start-heading, end-heading] — the 10 genuinely-untouched blocks.
const FROZEN = [
  ['01-gate-convention',   '### Gate Prompt Convention',                   '## Master Branch Protection (NON-NEGOTIABLE)'],
  ['02-master-protection', '## Master Branch Protection (NON-NEGOTIABLE)', '## Pre-flight Check (runs before Phase 1)'],
  ['03-preflight',         '## Pre-flight Check (runs before Phase 1)',     '## Phase 0: Spec Sync'],
  ['04-phase0',            '## Phase 0: Spec Sync',                         '## Phase 1: Issue Analysis'],
  ['05-phase1',            '## Phase 1: Issue Analysis',                    '## Phase 2: Branch & Worktree Creation'],
  ['06-phase2',            '## Phase 2: Branch & Worktree Creation',        '## Phase 3: Planning'],
  ['07-phase5',            '## Phase 5: Verification',                      '## Phase 5.5: Automated Acceptance Testing'],
  ['08-phase5_5',          '## Phase 5.5: Automated Acceptance Testing',    '## Phase 6: Review Prep'],
  ['09-phase6',            '## Phase 6: Review Prep',                       '## Phase 7: PR Creation'],
  ['10-phase7',            '## Phase 7: PR Creation',                       '## Edge Cases Summary'],
];

for (const [name, start, end] of FROZEN) {
  test(`frozen region byte-verbatim: ${name}`, () => {
    const golden = readFileSync(join(__dirname, 'golden', `${name}.md`), 'utf8');
    const current = block(start, end);
    assert.equal(
      current,
      golden,
      `frozen block "${name}" drifted from its golden — this block is part of work-issue's ` +
        `no-regression identity and must stay byte-verbatim. If the change is intentional, ` +
        `regenerate test/golden/${name}.md deliberately.`,
    );
  });
}

test('the additive Phase-3 planning-brain pointer IS present (the rewire landed)', () => {
  assert.match(
    SKILL,
    /workflows\/planning-brain\/planning-brain\.workflow\.mjs/,
    'Phase 3 should reference the planning-brain seed scriptPath',
  );
  assert.match(
    SKILL,
    /result\.master_plan/,
    'Phase 3 should render the planning-brain result.master_plan.* fields (with the null-guard)',
  );
});

test('the additive Phase-4 execution-engine pointer IS present (the rewire landed)', () => {
  assert.match(
    SKILL,
    /skills\/phasing-flow\/workflow\/phasing-flow-engine\.workflow\.mjs/,
    'Phase 4 should reference the execution-engine seed scriptPath',
  );
  assert.match(SKILL, /Mode B/, 'Phase 4 should document Mode B (engine = per-AC verify + diff-review gate)');
});

test('Phase 3.5 (the phasing detector) is DELETED + its flags are gone', () => {
  assert.doesNotMatch(SKILL, /## Phase 3\.5/, 'the Phase 3.5 heading must be gone');
  assert.doesNotMatch(SKILL, /GATE 3\.5/, 'the GATE 3.5 marker must be gone');
  assert.doesNotMatch(
    SKILL,
    /force phasing for the implementation portion/,
    'the old --phase flag definition must be gone',
  );
  assert.doesNotMatch(SKILL, /skip phasing entirely/, 'the old --no-phase flag definition must be gone');
});
