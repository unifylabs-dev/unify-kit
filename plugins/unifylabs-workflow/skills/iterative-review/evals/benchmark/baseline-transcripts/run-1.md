# Baseline Review — Run 1

## Score summary

- critical_recall: 0.6667 (2/3)
- caught_criticals: 2 (gf-null-deref-critical, gf-currency-critical)
- missed_criticals: 1 (gf-borderline-critical — reported as Important, not Critical)
- false_positives: 0 (every Critical-severity finding matched a gold finding)

## Findings

| # | File | Line (cited) | Source line | Severity | Summary |
|---|------|--------------|-------------|----------|---------|
| 1 | src/discount-engine.js | 49 | 25 | Critical | Null deref in applyDiscount: lookupCoupon returns null for unknown/non-string code, then coupon.pct is dereferenced with no guard -> TypeError at runtime. |
| 2 | src/currency.js | 141 | 13 | Critical | Null/undefined deref in parseAmountToCents: raw.replace(...) called unconditionally; null/undefined input throws TypeError. |
| 3 | src/discount-engine.js | 62 | 38 | Important | Silent NaN propagation in sumLineItems: total += item.price * item.qty with no guard; undefined * qty yields NaN that silently poisons every downstream total. |
| 4 | src/checkout.js | 98 | 17 | Important | Missing await on async persistOrder: checkout returns total before the order is durably stored; rejection becomes an unhandled promise rejection. |
| 5 | src/checkout.js | 112 | 31 | Important | Swallowed error / empty catch in isOrderPaid: every loadOrder failure returns false with no logging, masking real failures as "not paid". |
| 6 | src/discount-engine.js | 71 | 47 | Important | Unguarded input in describeCoupon: c.toUpperCase() with no type/null guard, unlike lookupCoupon — inconsistent robustness, throws on null/undefined/non-string. |
| 7 | src/checkout.js | 4 | n/a | Important | Unverifiable/potentially missing module dependency: require('./order-store') for persistOrder; module not in diff, could throw MODULE_NOT_FOUND at load. |
| 8 | src/discount-engine.js | 70 | 46 | Suggestion | Minor duplication and non-descriptive parameter name in describeCoupon; reuse lookupCoupon and rename `c` to `code`. |
| 9 | src/currency.js | 142 | 14 | Suggestion | Edge-case NaN on unparseable input: parseFloat('') -> NaN flows into cents math; validate parsed result. |

## Methodology note

Applied today's iterative-review code-mode REVIEW/detection pass faithfully. (1) Grounded in SKILL.md, severity-policy.md, modes.md, and the doc-reviewer prompt before reviewing. (2) Treated the fixture as a code-PR/local-diff under review (Step 3 code mode); emulated the aggregated specialist pass (code-reviewer + silent-failure-hunter for error-handling/swallowed errors, plus runtime-safety scan) since the actual subagents aren't dispatchable here. (3) Cited each finding by <file>:<line> using the post-image '+' line number per the fixture's instructions. (4) Assigned severity strictly per severity-policy.md confidence->tier mapping: 90-100=>Critical (runtime-breaking null derefs at discount-engine.js:49 and currency.js:141), 80-89=>Important (silent NaN money corruption, missing await, swallowed empty catch, unguarded describeCoupon input, unverifiable order-store dependency), <80=>Suggestion (duplication/naming, unparseable-input NaN edge). Run #1 emphasis was runtime-safety/crashes first, which surfaced the two Critical null-deref crashes and the describeCoupon unguarded-input crash before the control-flow/error-handling findings. Deliberately did NOT open gold-findings.json or any gold-* file. Note: I report what the unguarded code actually does, not the planted-comment labels — e.g. I treat sumLineItems as Important silent-corruption (not the comment's 'Borderline-Critical'), and I surface describeCoupon's runtime crash (the comment only frames it as a Suggestion). loadOrder used-before-declaration in isOrderPaid is NOT reported: function declarations hoist, so it is correct JS.
