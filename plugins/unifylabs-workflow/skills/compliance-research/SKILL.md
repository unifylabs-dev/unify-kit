---
name: compliance-research
description: Interactive compliance profile selection + gap analysis. Walks user through industry, geography, data classes, and customer geography to recommend a compliance profile (baseline-pipeda, healthcare-phipa, financial-canada, general-soc2). Uses context7 + WebSearch to ground on current regulations (compliance evolves; cannot rely on training data alone). Gap-analyzes existing docs/compliance/ against the recommended profile and writes docs/compliance/research-notes/<date>-<topic>.md. Use when the user says "/compliance-research", "what compliance profile should I use", or starts a new regulated project.
---

# compliance-research

Walk the user through a structured intake, recommend one or more
compliance profiles (composition allowed), ground the recommendation in
current regulatory text via `context7` + `WebSearch`, gap-analyze
existing project docs, and write a research note for the rationale.

## When to invoke

- User explicitly invokes `/compliance-research`.
- A new project's intake mentions a regulated industry, sensitive data
  class, or a specific regulator.
- User asks "what compliance profile should I use", "do we need a
  SOC 2", "is PHIPA in scope", etc.
- An existing project is about to handle a new data class (e.g.,
  adding payment processing, starting to handle PHI).

## What it does **not** do

- Issue legal advice. Every output frames the recommendation as
  scaffolding requiring counsel review.
- Replace a compliance officer's judgement. The skill's output is an
  on-ramp, not an audit.
- Author new profile content. New profiles are added by humans through
  the regular contribution flow.

## Step 1 — Industry

Use `AskUserQuestion`:

- **Question**: "What industry does this project primarily serve?"
- **Options**: `healthcare`, `financial services`, `B2B SaaS`, `consumer
  SaaS` (+ user can pick Other for free-text).

If the user picks Other, capture the free text.

## Step 2 — Customer geography

`AskUserQuestion`:

- **Question**: "Where are this project's customers / end-users
  located?"
- **Options**: `Canada-only`, `US`, `EU`, `Global` (+ Other).

## Step 3 — Data classes

`AskUserQuestion` with `multiSelect: true`:

- **Question**: "Which data classes does this project handle?"
- **Options**: `PHI (personal health info)`, `PII (general)`,
  `financial (account / transaction)`, `payment cards (PCI)`,
  `biometric`, `none of these` (+ Other).

## Step 4 — Specific regulator mentioned

`AskUserQuestion`:

- **Question**: "Has a stakeholder or customer named a specific
  regulator or framework you must align with?"
- **Options**: `no`, `yes (please specify)` — if yes, the user provides
  text via Other.

## Step 5 — Recommend profile(s)

Apply this deterministic mapping (then narrate the reasoning to the
user):

| Industry | Geo | Data classes | Recommendation |
|---|---|---|---|
| healthcare | Canada-only / Global incl. Canada | PHI present | `baseline-pipeda` + `healthcare-phipa` |
| healthcare | Canada-only / Global | PHI absent | `baseline-pipeda` (project will handle PII but not PHI yet) |
| financial services | Canada-only / Global incl. Canada | financial present | `baseline-pipeda` + `financial-canada` |
| B2B SaaS | any | any | `baseline-pipeda` (if Canada) + `general-soc2` |
| consumer SaaS | Canada-only | PII present | `baseline-pipeda` |
| anything | US-only | (any) | **out of scope for v2** — recommend the user defer or contribute a US-focused profile |
| anything | EU | (any) | **out of scope for v2** — recommend the user defer or contribute a GDPR profile |
| anything | (any) | payment cards (PCI) present | **out of scope for v2** — recommend PCI-DSS-focused work outside the kit |

If a specific regulator was named in Step 4:

- **PHIPA / Ontario health privacy** → add `healthcare-phipa`.
- **PIPEDA / OPC** → ensure `baseline-pipeda` is in the set.
- **FINTRAC / PCMLTFA / Canadian AML** → add `financial-canada`.
- **SOC 2 / TSC / AICPA** → add `general-soc2`.
- **HIPAA / HITECH / GDPR / CCPA / FERPA / PCI-DSS** → flag as out of
  scope for v2; recommend the user document the requirement in the
  research note and pursue specialized counsel.

For ambiguous combinations, present the strongest match and explain
what falls outside the v2 profile set.

## Step 6 — Gap-analyze existing docs (conditional)

If `docs/compliance/` exists in the current project:

- List its current files.
- For each file expected by the recommended composition (see profile
  READMEs), check presence.
- For each present file, do a lightweight scan for likely staleness
  indicators:
  - Date strings older than 18 months in headers.
  - URLs to regulator pages that have known-moved (e.g., old OPC
    breach-form URLs).
  - PHIPA timeline language that uses informal "as soon as possible"
    without the current statutory framing.
- Report what's missing and what looks stale; do NOT modify the
  existing files.

If `docs/compliance/` does not exist, skip this step and note that
the project starts fresh.

## Step 7 — Fetch current regulatory text

For each regulator implicated by the recommendation, attempt a lookup
in this order:

1. **context7 MCP** (where the regulator publishes structured docs that
   context7 indexes — best for AICPA TSC, NIST, where available):
   - `mcp__context7__resolve-library-id` with the regulator term.
   - If a match is returned, `mcp__context7__query-docs` for the
     relevant topic.
2. **WebSearch** (fallback for Canadian regulator pages, which are
   typically not in context7):
   - Search for the current page URL + access date.
   - Capture the published date if the regulator surfaces one.
3. **Neither tool available** → mark `sources_fetched: false` in the
   research-note frontmatter and proceed with a recommendation grounded
   in the profile READMEs only.

For each fetch, capture:

- Source URL.
- Title / snippet.
- Access date (today's date in YYYY-MM-DD).

## Step 8 — Write the research note

Write to `docs/compliance/research-notes/<YYYY-MM-DD>-<topic-slug>.md`
(create the directory if it doesn't exist). Use this structure:

```markdown
---
date: <YYYY-MM-DD>
topic: <slug>
industry: <answer>
geography: <answer>
data_classes: [<list>]
recommended_profile: <profile or composition>
sources_fetched: <true|false>
sources:
  - url: <url>
    title: <title>
    accessed: <YYYY-MM-DD>
  - ...
---

# Compliance recommendation — <topic>

## Inputs

- Industry: <answer>
- Geography: <answer>
- Data classes: <list>
- Specific regulator(s) mentioned: <answer or "none">

## Recommendation

<one-paragraph plain-language summary of the recommended profile or
composition, naming each profile and what it covers>

## Reasoning

<3–6 bullet points connecting the inputs to the recommended profiles>

## Gap analysis

<if docs/compliance/ existed: list missing files and likely-stale
files; otherwise: "starting fresh — no existing docs/compliance/
directory to compare against">

## Sources

<bulleted list of fetched URLs with access dates; if sources_fetched
is false, note "regulatory content not fetched this session — verify
profile claims against current regulator pages before relying">

## Next steps

1. Install the recommended profile(s) via `init-project.sh
   --compliance=<profile>` (phase-4 init wiring; verify status in
   templates/README.md).
2. Counsel review before any externally-facing artifact (privacy
   policy, breach notification, vendor DPAs) is finalized.
3. <profile-specific next step — e.g., for healthcare-phipa: identify
   whether the project is a HIC or Agent of a HIC>.

## Disclaimer

This is a starting-point recommendation, not legal advice. The profile
content the kit ships is scaffolding, not a substitute for qualified
counsel review.
```

Tell the user the file path that was written.

## Failure modes

- **`AskUserQuestion` unavailable** → fall back to plain-language
  prompts, one question per turn; capture answers via the user's
  free-text response.
- **`context7` and `WebSearch` both unavailable** → still produce a
  recommendation grounded in the profile READMEs; set
  `sources_fetched: false` in the frontmatter; flag the limitation in
  the "Sources" section.
- **User invokes the skill outside a project root** → ask the user
  whether to (a) write the note in `~/compliance-research-notes/` as
  a scratch file, or (b) abort. Default behaviour is to ask, not
  silently move.
- **No clear profile recommendation** (e.g., US-only project) → write
  the note anyway with a "no v2 profile matches; recommend
  contribution of a new profile or deferral" recommendation.

## Tone and framing

- Descriptive, not prescriptive. "PIPEDA's notification threshold is
  RROSH" — not "you are required to…".
- Always cite. Every regulatory claim links to the source.
- Always disclaim. Every note ends with the disclaimer block.
- Never include legal-advice voice ("you must", "you are required to",
  "compliance with this profile guarantees…").
