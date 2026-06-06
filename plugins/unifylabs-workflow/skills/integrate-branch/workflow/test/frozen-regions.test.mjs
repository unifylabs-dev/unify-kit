// frozen-regions.test.mjs — content-anchored guard that the M3 rewire (and any
// future edit) keeps the integrate-branch SKILL.md Phase-3 route gate and the
// Phase-4 salvage/rebuild/discard handoffs BYTE-VERBATIM (no-regression: those
// blocks are the skill's identity; the rewire only adds a Phase-2 seed pointer).
//
// CONTENT-ANCHORED (fix #10): the blocks are sliced between exact `## Phase N`
// heading STRINGS, NOT line ranges — immune to line-number drift from edits
// elsewhere (e.g. the additive Phase-2 seed-pointer block, or doc ripple). The
// `## Branch summary` etc. lines inside Phase 3's report-template code fence are
// captured AS PART of the block (they live between the Phase-3 and Phase-4
// heading anchors), so the fence content is frozen too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL = readFileSync(join(__dirname, '../../SKILL.md'), 'utf8');

function block(startHeading, endHeading) {
  const a = SKILL.indexOf(startHeading);
  assert.notEqual(a, -1, `frozen-region anchor not found: ${startHeading}`);
  const b = SKILL.indexOf(endHeading, a + startHeading.length);
  assert.notEqual(b, -1, `frozen-region end anchor not found: ${endHeading}`);
  return SKILL.slice(a, b);
}

test('Phase 3 (route recommendation + report format + route-confirm gate) is byte-verbatim', () => {
  const golden = readFileSync(join(__dirname, 'golden/phase-3.md'), 'utf8');
  const current = block('## Phase 3: Route recommendation', '## Phase 4: Execute the route');
  assert.equal(current, golden, 'Phase 3 block drifted from the frozen golden — the route gate must stay verbatim (no-regression). If this change is intentional, regenerate golden/phase-3.md deliberately.');
});

test('Phase 4 (salvage / rebuild / discard handoffs) is byte-verbatim', () => {
  const golden = readFileSync(join(__dirname, 'golden/phase-4.md'), 'utf8');
  const current = block('## Phase 4: Execute the route', '## Phase 5: Final quality gate');
  assert.equal(current, golden, 'Phase 4 block drifted from the frozen golden — the salvage/rebuild/discard handoffs must stay verbatim (no-regression). If intentional, regenerate golden/phase-4.md deliberately.');
});

test('the additive Phase-2 seed pointer IS present (the rewire landed)', () => {
  assert.match(SKILL, /### Run via the committed audit seed/, 'the M3 Phase-2 seed-pointer block should be present');
  assert.match(SKILL, /integrate-audit\.workflow\.mjs/, 'the seed scriptPath should be referenced in Phase 2');
});
