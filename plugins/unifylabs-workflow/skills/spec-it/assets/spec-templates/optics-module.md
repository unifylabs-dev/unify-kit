---
name: <module-name>
type: template
last_reviewed: YYYY-MM-DD
related_issues: []
related_journeys: []
code_anchors:
  - src/lib/actions/<file>.ts
  - src/lib/validations/<file>.ts
  - src/app/<route>/page.tsx
---

<!--
  When you duplicate this file:
    1. Rename the file to `<module-name>.md` (kebab-case).
    2. Change `type: template` above to `type: module`.
    3. Replace every `<placeholder>` with real content.
    4. Set `last_reviewed:` to today's date (YYYY-MM-DD).
    5. Fill `related_issues:` (issue numbers as `#NN`) and `related_journeys:`
       (journey slugs that touch this module).
    6. Replace `code_anchors:` paths with the real file paths into the
       codebase. Do not copy code from these files into the spec — link only.
    7. Add a row to `docs/specs/README.md` under "Module specs".
    8. Aim for 200–500 total lines. Longer = documenting implementation. Cut.
-->

# <Module Name>

## Purpose

<!--
  Why this module exists. 1–3 sentences. The user / business problem it solves.
  Avoid "this module manages X" — describe the problem, not the implementation.
-->

## Behavior

<!--
  The rules of how this module behaves. The longest section. ~50–250 lines.

  Use a numbered list of behavioral statements.
  Format invariants as: "When <trigger>, the system <effect>."

  Group related rules under sub-headings (### State transitions, ### Validation
  rules, etc.) when the section grows past ~30 bullets.
-->

1. When <trigger>, the system <effect>.
2. ...

## Data Model

<!--
  Key entities and relationships. Link to `prisma/schema.prisma`; do NOT copy
  the schema into this section.

  Document non-obvious fields, enums, and constraints. Document mapped DB
  column names (snake_case via @map) where they differ from Prisma fields.

  Example:
    - `Order.status` is `OrderStatus` enum: DRAFT, CONFIRMED, LAB_ORDERED,
      LAB_RECEIVED, VERIFIED, READY, PICKED_UP, CANCELLED.
    - `Order.totalCustomer` and `Order.totalReal` differ when
      `Order.isDualInvoice = true` (see `invoices` module).
-->

## Permissions

<!--
  Per-role access matrix. Cover VIEWER / STAFF / ADMIN, plus client (where
  relevant). Show what each role can read, write, and what's denied.

  Use a table.
-->

| Role | Read | Write | Notes |
|---|---|---|---|
| VIEWER | | | |
| STAFF | | | |
| ADMIN | | | |
| Client (portal) | | | (omit row if not applicable) |

## Edge Cases & Constraints

<!--
  The non-obvious situations that have caught us before. Format:
  "When <unusual condition>, then <how the system handles it>."

  Examples of good edge cases to document:
    - Race conditions handled or accepted
    - Null / empty / boundary values
    - Behavior under partial failure
    - Idempotency guarantees
    - Soft-delete semantics
-->

- When ...

## Compliance Notes

<!--
  PHIPA / PIPEDA-relevant decisions. Audit logging requirements for this module
  (which actions emit `logAudit` calls and with which `action:` enum values).
  Data residency, consent capture, retention rules.

  If the module has no compliance-relevant behavior, write:
  "No PHI or PII handled — no compliance constraints apply."
-->

## Integration Points

<!--
  Other modules this one reads from or writes to. Cron jobs that touch it.
  Notifications it emits. Downstream effects on other modules.

  Format as a list:
    - Reads from: <module-name> (<reason>)
    - Writes to: <module-name> (<reason>)
    - Emits notifications: <NotificationType> (<when>)
    - Triggered by cron: <cron-name> (<schedule>)
-->

## Open Questions / Known Limitations

<!--
  Things we know are imperfect but haven't fixed. TODOs that survive across PRs.
  Open product questions. Constraints we're aware of but not blocking on.
-->

## Changelog

<!--
  Terse history. One line per significant change with PR link.
  Format: `- YYYY-MM-DD: <change description>. (#<PR-number>)`
-->

- YYYY-MM-DD: Initial spec captured. (#<PR>)
