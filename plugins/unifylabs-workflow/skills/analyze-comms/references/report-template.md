# Communication Analysis Report Template

Use this template for every communication analysis. All 6 sections are required.
Adapt detail level to the communication's complexity, but never skip a section.

## File naming

Analysis files: `[sender]_[topic]_[date]_analysis.md`
Reply drafts: `[sender]_[topic]_[date].md`

All lowercase, underscores as word separators.
Date format: `monthDD` (e.g., `april3`, `march25`).

Examples:
- `marks_msa_review_april3_analysis.md`
- `jeff_wealthica_update_march27_analysis.md`
- `ania_nbin_clarification_march25.md` (reply draft)

## File placement

| Content type | Location | When |
|-------------|----------|------|
| Communication PDFs | `deliverables/emails/pdf/` | Default for all communication PDFs |
| Legal PDFs | `legal/pdf/` | Legal documents, contracts, NDA reviews |
| General analyses | `deliverables/emails/` | Vendor updates, client emails, status reports |
| Legal analyses | `legal/` | Contract reviews, legal feedback, compliance |
| Reply drafts | `deliverables/emails/` | All outgoing replies |

If the user provided a destination path hint at invocation, use it instead of defaults.
If a directory does not exist, create it before writing files.

## Report template

Use the following structure exactly. Replace bracketed placeholders with actual content.

---

```markdown
# [Communication Type] Analysis — [Brief Description]

> **Date:** [analysis date]
> **Source:** [sender name, their organization/role]
> **Document:** [filename or "pasted text"]
> **Purpose:** Internal analysis

---

## 1. Summary

[2-3 sentences. What was received, from whom, headline takeaway.
Be specific: not "an email was received" but "Jeff confirmed NBIN
credential-based connector is broken and suggested MyPortfolio+ as fallback."]

## 2. Key findings

- **[Finding label]** — [What was said or decided]. *[New information | Confirmation | Change from previous | Contradiction]*
- **[Finding label]** — [What was said or decided]. *[Tag]*

[Example of well-formed findings:]
- **Aviso coverage confirmed** — Wealthica supports both Aviso Wealth and Qtrade as separate connectors. *Confirmation of prior verbal commitment.*
- **NBIN connector broken** — Credential-based connector for NBIN is unpublished (in outage). Direct feed is mandatory. *New information — escalates NBIN risk.*
- **Transaction history depth** — Laurentian and Raymond James credential connectors confirmed with "All" (full) history. *Confirmation — resolves open question from March 18.*

## 3. Implications

### For the project
[How does this affect timeline, scope, architecture, or deliverables?
Be specific about what changes and what stays the same.]

### For [user name]
[What decisions does the user need to make? What actions fall on them?
What strategic calls are now in play?]

### For the client
[How does this affect the client relationship? Their expectations?
Any promises made or timelines shifted?]

## 4. Risk assessment

### New risks introduced
- **[Risk name]** — [Description]. Severity: [Low/Medium/High/Critical]

### Existing risks resolved or escalated
- **[Risk reference]** — [Previous status] → [New status]. [Rationale for change]

### Risk level changes
[Reference existing risk tracking documents if found in the repo.
Note any risks that need to be added or updated.]

## 5. Action items

### Immediate (this week)
1. [ ] [Action — who needs to do what]
2. [ ] [Action]

### Short-term (next 2 weeks)
1. [ ] [Action]

### Pending decision
1. [ ] [Decision needed] — blocked on [what/whom]

## 6. Questions for you

[These questions are presented at GATE 1 and must be answered before
proceeding to reply drafting or repo updates.]

1. [Clarifying question about a decision or ambiguity]
2. [Strategic direction question]
3. [Question about how to handle a specific finding]
```
