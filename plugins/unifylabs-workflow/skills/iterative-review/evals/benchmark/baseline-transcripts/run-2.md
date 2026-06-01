# Baseline Review — Run 2

## Score summary

- critical_recall: 0.6667 (2/3)
- caught_criticals: 2 (gf-null-deref-critical, gf-borderline-critical)
- missed_criticals: 1 (gf-currency-critical — not reported in src/currency.js)
- false_positives: 0 (every Critical-severity finding matched a gold finding)

## Findings

| # | File | Line (cited) | Source line | Severity | Summary |
|---|------|--------------|-------------|----------|---------|
| 1 | src/discount-engine.js | 49 | 25 | Critical | Null deref in applyDiscount: lookupCoupon returns null for unknown/non-string code, then coupon.pct read with no guard -> TypeError at runtime. |
| 2 | src/discount-engine.js | 62 | 38 | Critical | Silent money-math corruption in sumLineItems: undefined * n -> NaN propagates through the sum and poisons every downstream total on the happy path; rated Critical (corrupts money with no error). |
| 3 | src/checkout.js | 98 | 17 | Important | Missing await on async persistOrder: fire-and-forget; checkout returns total before durable persist, rejection becomes unhandled. |
| 4 | src/checkout.js | 113 | 32 | Important | Swallowed error in isOrderPaid: catch discards error and returns false, masking real load failures as "not paid". |
| 5 | src/checkout.js | 84 | 3 | Important | Unresolved module dependency: require('./order-store') not in diff; require could throw at import time. |
| 6 | src/discount-engine.js | 71 | 47 | Important | Missing null/type guard in describeCoupon: c.toUpperCase() direct call throws on null/undefined/non-string; inconsistent with lookupCoupon. |
| 7 | src/discount-engine.js | 70 | 46 | Suggestion | describeCoupon duplicates the uppercase-and-lookup logic; non-descriptive `c` param. Reuse lookupCoupon, rename to `code`. |
| 8 | src/checkout.js | 119 | 38 | Suggestion | loadOrder is a hardcoded stub always returning 'pending'; combined with the swallowing catch, isOrderPaid behaves as constant false. Flag for follow-up. |

## Methodology note

Applied today's iterative-review CODE-mode detection pass per SKILL.md Steps 1-4 and the severity-policy reference. Mode resolved to code (single frozen diff fixture); I treated the patch text as the diff under review and did not apply it. Per run #2 emphasis I led with error-handling and control-flow, then reconciled against runtime-safety. I traced each new function for null/undefined dereferences, silent NaN/data corruption, async/await correctness, and swallowed errors, assigning severities strictly by the confidence->tier mapping (>=90 + runtime-break/contract = Critical; 80-89 + silent-failure/edge-case/quality = Important; <80 or style/refactor = Suggestion). I did NOT read gold-findings.json or any gold-* file. Notable judgment calls a careful reviewer makes here: (1) sumLineItems silent NaN propagation rated Critical rather than Important because it corrupts money math on the happy path with no error surfaced; (2) the './order-store' require flagged as a possible broken dependency given the self-contained framing; (3) describeCoupon split into two findings — the missing null guard (Important, a real edge-case bug paralleling lookupCoupon's guard) versus the cosmetic duplication / `c` naming (Suggestion). I did not enter the fix loop or run a verifier — this is a detection-only baseline pass. Note: the diff's own inline comments label planted bugs, but I evaluated each finding on its own technical merits per the severity policy rather than trusting the labels.
