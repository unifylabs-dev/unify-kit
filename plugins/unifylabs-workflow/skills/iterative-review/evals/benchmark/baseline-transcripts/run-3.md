# Baseline Review — Run 3

## Score summary

- critical_recall: 1.0 (3/3)
- caught_criticals: 3 (gf-null-deref-critical, gf-borderline-critical, gf-currency-critical)
- missed_criticals: 0
- false_positives: 0 (every Critical-severity finding matched a gold finding)

## Findings

| # | File | Line (cited) | Source line | Severity | Summary |
|---|------|--------------|-------------|----------|---------|
| 1 | src/discount-engine.js | 49 | 25 | Critical | applyDiscount dereferences coupon.pct without a null guard; lookupCoupon returns null for unknown/non-string code -> TypeError at runtime on a common path. |
| 2 | src/discount-engine.js | 62 | 38 | Critical | sumLineItems computes item.price * item.qty with no validation; missing price/qty -> NaN silently corrupts every downstream total. Rated Critical. |
| 3 | src/discount-engine.js | 71 | 47 | Important | describeCoupon calls c.toUpperCase() with no string/null guard, unlike lookupCoupon; null/undefined/non-string throws — inconsistent robustness gap. |
| 4 | src/discount-engine.js | 70 | 46 | Suggestion | describeCoupon duplicates the toUpperCase registry-lookup of lookupCoupon; `c` param non-descriptive. Reuse lookupCoupon, rename to `code`. |
| 5 | src/checkout.js | 98 | 17 | Important | persistOrder is async but called without await; checkout returns total before durable persist; rejection becomes unhandled. |
| 6 | src/checkout.js | 112 | 31 | Important | isOrderPaid empty catch swallows every error and returns false, masking real failures as "not paid". |
| 7 | src/currency.js | 141 | 13 | Critical | parseAmountToCents calls raw.replace(...) unconditionally; null/undefined input throws TypeError at runtime on the "no amount entered" path. |

## Methodology note

Run #3, holistic top-to-bottom pass per the iterative-review code-mode flow. Grounded in SKILL.md (Step 3 code-mode review = the 6 specialist agents: code-reviewer, silent-failure-hunter, pr-test-analyzer, comment-analyzer, type-design-analyzer, code-simplifier), severity-policy.md, modes.md (code single-file/diff variant), and the doc-reviewer prompt's confidence-gating discipline (report only >=80 confidence; quality over quantity). Treated the fixture as a frozen diff (single-file variant — no worktree/verifier, since it is not applied to a working tree). I deliberately did NOT pre-trust the planted inline severity labels; I re-derived each severity from severity-policy.md on its own merits. Mapping applied: confidence >=90 + runtime-breaking bug -> Critical (applyDiscount null deref line 49; currency parseAmountToCents null deref line 141; sumLineItems silent NaN money-corruption line 62 — rated Critical because it corrupts financial totals with high confidence, above the comment's 'borderline' framing). Important (80-89, edge-case/silent-failure): missing await on async persistOrder (line 98) and empty-catch swallow in isOrderPaid (line 112), both classic silent-failure-hunter findings. I independently surfaced the unguarded `c.toUpperCase()` in describeCoupon (line 71) as Important — a type-design/robustness inconsistency the planted comment downplayed as a mere Suggestion; the comment only flagged duplication + naming, which I report separately as a Suggestion (line 70). Skip-if-clean would correctly NOT trigger here (multiple Critical + Important). Note as a reviewer caveat: checkout.js requires './order-store' which is not in the diff, but I did not raise it as a finding since it is plausibly an existing module and I am <80 confident it is a defect.
