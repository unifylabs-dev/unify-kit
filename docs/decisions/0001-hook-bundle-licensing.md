# 0001 — Hook bundle, audit-scan, GH Actions workflow, and security-checklist reclassified from `verbatim` / `verbatim-with-light-edit` to `customization`

- **Status:** accepted
- **Date:** 2026-05-04
- **Decision:** The six security hooks (`dangerous-actions-blocker.sh`, `pre-commit-secrets.sh`, `output-secrets-scanner.sh`, `file-guard.sh`, `claudemd-scanner.sh`, `mcp-config-integrity.sh`), `scripts/audit-scan.sh`, the consumer-shipped GitHub Actions workflow (`github-actions/claude-code-review.yml` + `github-actions/prompts/code-review.md`), AND `templates/core/security-checklist.md` are sourced as **`customization`** per spec 00 — not **`verbatim`** (hooks / audit-scan / workflow) or **`verbatim-with-light-edit`** (security-checklist). The phase author writes original shell expression that implements the documented patterns; `github.com/FlorianBruniaux/claude-code-ultimate-guide` is cited as conceptual prior art via per-file header comments ("based on patterns from …, expression authored"). No bytes from the upstream are copied into the kit.
- **Context:** Specs 00, 03, and 05 were drafted on the assumption that FlorianBruniaux/claude-code-ultimate-guide is licensed CC0 1.0. Phase 2 of the v0.1 implementation run discovered the actual license is **CC BY-SA 4.0** (verified via three independent signals: GitHub's SPDX detection, the upstream root `LICENSE` file, and the README badge). CC BY-SA 4.0 is a copyleft Creative Commons license whose share-alike clause requires derivative works to be licensed under CC BY-SA 4.0 or a CC-listed compatible license. MIT — the kit's policy for shipped code per spec 00 §"License" — is not on that compatibility list. Lifting the upstream hooks verbatim into `hooks/*.sh` and shipping under MIT would create real legal risk for adopters, not a stylistic mismatch. Phase 2 halted at sub-batch A step 1 per the spec's "do not silently lift" hard rule.
- **Consequences:**
  - Spec 03 §"Hook bundle (v1)" reclassifies the six hooks from `verbatim` to `customization`. The "Source path" column becomes "Pattern reference" — a non-load-bearing pointer to where the pattern can be observed, not a license-bound source.
  - Spec 05 §"2. `audit-scan.sh`" reclassifies from `verbatim` to `customization`. The kit-additions block at the bottom is no longer "additions on top of an upstream lift" — the whole script is original. The fence comment is reworded accordingly.
  - Spec 00 §"License" / §"Attribution policy" gains a footer note: when an upstream's license is incompatible with the kit's MIT-for-code policy (copyleft, share-alike, GPL-style), the kit authors from patterns rather than lifts expression. The four sourcing modes are unchanged; only the license-compatibility precondition for `verbatim` lifts is tightened.
  - Per-hook header comments change format. Old (`verbatim`): `Source: <upstream URL> / Sourcing mode: verbatim / Upstream license: CC0 1.0 Universal / Lift date: …`. New (`customization`): `Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes") / Pattern reference: <upstream URL> (CC BY-SA 4.0 — patterns documented; expression authored independently) / Authored: 2026-05-04`.
  - Phase 2 spec is revised to drop the upstream-license verification gate (the gate was for verbatim lifts; we no longer lift) and to specify behavioral contracts per hook drawn from spec 03's "Action" column. The phase author implements those contracts in original shell.
  - Authoring cost increases by ~2–4 hours over the verbatim-lift baseline. The hooks are short (~150 lines each per phase-2 session's discovery) and the patterns are well-documented in spec 03's table, so the increase is bounded.
  - The kit's overall identity stays cleanly **MIT for code, CC0 for templates, CC BY-SA 4.0 for narrative docs** (per spec 00). No copyleft footprint propagates to consumers.
  - This decision sets a precedent: the kit lifts expression only from genuinely permissive sources (CC0 / MIT / Apache-2.0). Future considered lifts from copyleft sources require either an ADR re-opening this trade-off or a `customization` / `pattern-only` re-classification.
- **Alternatives considered:**
  - **Multi-license the kit** — add a fourth file class to spec 00's License table for `hooks/*.sh` + `scripts/audit-scan.sh`, shipping those under CC BY-SA 4.0 alongside MIT-for-net-new-code. Cheapest authoring cost (no re-write needed). Rejected because share-alike propagates to every fork of the kit, complicating downstream consumers' license stories indefinitely. Also blurs the kit's identity from "cleanly permissive" to "mostly permissive with a copyleft island."
  - **Replace the upstream source** — find another CC0/MIT/Apache-2.0 collection of equivalent hooks. Rejected because no comprehensive equivalent exists; would collapse into the same authoring effort as `customization` while losing the conceptual-prior-art citation that documents intellectual lineage.
  - **Lift verbatim and ignore the conflict** — explicitly forbidden by phase-2 spec ("do not silently lift under wrong attribution") and by Free Software Foundation analysis of CC BY-SA 4.0 vs. MIT compatibility. Not a credible option.
- **Supersedes / superseded by:** none. This is the first ADR for the kit.

## Affected files

Spec patches landed in the same commit as this ADR (initial scope: hooks + audit-scan):

- `specs/00-vision-and-license.md` — Revisions footer extended with a v0.3 revision note.
- `specs/03-hooks.md` — Hook bundle section heading reclassified `verbatim` → `customization`; "Source path" → "Pattern reference"; per-hook header comment template updated; Revisions footer extended.
- `specs/05-scripts.md` — `audit-scan.sh` reclassified `verbatim` → `customization`; "Kit additions" framing updated to "kit-specific checks within an originally-authored script"; Revisions footer extended.

Phase-2 spec (in run-dir + GitHub issue #3) revised to reflect the new classification: drops the upstream-license verification gate, replaces "lift verbatim" steps with "author from documented patterns," updates header-comment templates, retains the same deliverables and verification surface.

**Scope extension (2026-05-04, post-Phase 4):**

Phase 4 of the v0.1 implementation run shipped the consumer GitHub Actions workflow under the same `customization` posture for the same upstream-license reason. Scope of this ADR is extended retroactively to cover that reclassification. The phase author authored the workflow YAML and prompt originally; per-file headers cite `github.com/FlorianBruniaux/claude-code-ultimate-guide/examples/github-actions/` as `Pattern reference:`, not `Source:`.

- `specs/04-github-actions.md` — `## v1 workflow shipped` heading reclassified `verbatim` → `customization`; v0.3 revision footer extended.

**Scope extension (2026-05-04, post-Phase 5):**

Phase 5 shipped `templates/core/security-checklist.md` under the same `customization` posture. Spec 02 §5 originally specified `verbatim-with-light-edit` with a 3-bullet diff rule (kept OWASP, dropped threat-db references, added Next.js example block). The 3-bullet *intent* is preserved, but the prose itself is now 100% kit-authored — none of the upstream wording survives. Scope of this ADR is extended retroactively to cover the reclassification.

- `specs/02-templates.md` — `### 5. security-checklist.md` heading reclassified `verbatim-with-light-edit` → `customization`; v0.3 revision footer added.

The reasoning is identical across all three extensions: CC BY-SA 4.0 share-alike is incompatible with the kit's MIT-for-code policy, so the kit authors expression originally and cites the upstream as conceptual prior art only. The pattern is now well-established — any future `verbatim` or `verbatim-with-light-edit` lift from a copyleft upstream should default-reclassify to `customization` without re-litigating, and any further scope extensions to this ADR should follow the same shape.

## Verification — share-alike incompatibility (citations)

- CC BY-SA 4.0 deed: <https://creativecommons.org/licenses/by-sa/4.0/> ("If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.")
- CC compatibility list: <https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/> — MIT is not listed as a CC BY-SA 4.0 compatible license.
- CC FAQ on software: <https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software> — Creative Commons explicitly recommends against using CC licenses for software, but does not invalidate them when applied; the share-alike obligation still binds derivatives.
- GitHub SPDX detection for upstream: `gh api repos/FlorianBruniaux/claude-code-ultimate-guide --jq '.license.spdx_id'` returns `CC-BY-SA-4.0` (verified 2026-05-04).
