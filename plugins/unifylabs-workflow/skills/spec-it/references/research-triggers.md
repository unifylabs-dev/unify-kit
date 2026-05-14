# Research triggers — Phase 2 stream selection

Phase 2's "Grounded research" has seven sub-streams. Running all seven on every invocation is wasteful — most features need 2 or 3. This file is the trigger-by-trigger guide: when each stream fires, what it produces, and how to keep cost down.

The orchestrator should announce which streams it's about to run BEFORE running them so the user can veto upfront.

---

## Stream priorities

**Always run** (cheap, high-value):
- 2a Repo research
- 2b Memory check

**Conditionally run** (only when triggers fire):
- 2c Prior art in sibling repos
- 2d Library/framework docs (context7)
- 2e Industry standards (WebSearch)
- 2f Prototype awareness

**Always run, last** (synthesis):
- 2g Impact map

---

## 2a Repo research — always

**Why always:** the spec must reference real files and real existing behavior. No research is more critical than this.

**Cost:** low. Mostly Read + Grep on the local repo + 1 Explore agent call if scope is uncertain.

**Outputs:**
- Candidate spec list (which modules/journeys/numbered specs are impacted)
- Existing behavior summary (what's there today)
- Similar past features (PR links from `git log` and `gh issue list`)

---

## 2b Memory check — always

**Why always:** the user's auto-memory accumulates feedback, project decisions, and conventions over months of conversations. Ignoring it means re-litigating settled questions.

**Cost:** very low. One Read of `~/.claude/projects/<project-slug>/memory/MEMORY.md`.

**Outputs:**
- Relevant feedback/project/reference memories
- Contradictions (if any) between Phase 1 brainstorm and saved memories

**How to find the project slug:** the cwd path with `/` replaced by `-`, prefixed by `-`. For example:
- `/Users/tomerkurman/optics-management` → `-Users-tomerkurman-optics-management`
- Path: `~/.claude/projects/-Users-tomerkurman-optics-management/memory/MEMORY.md`

If MEMORY.md doesn't exist, the user hasn't built up project memory yet — skip cleanly.

---

## 2c Prior art in sibling repos — conditional

**Triggers:**
- Feature name suggests a cross-project pattern: "client portal", "magic link auth", "intake form", "settings page", "notification system", "audit log viewer", "kanban", etc.
- Brainstorm output references "like project X does it" or "similar to Y"

**Cost:** medium. Requires scanning sibling repos via Explore agent.

**Outputs:**
- Prior art examples — sibling repos that implement similar patterns, with file path references

**How:**
1. `ls ~/Projects/ | grep -E "^unify-"` and `ls ~/ | grep -E "^unify-"` to find sibling repos
2. For each, use Explore agent with a focused query: "Find any implementation of <pattern> — server actions, components, DB tables"
3. Surface hits with one-line summaries + file paths (not full content)

**Skip when:** feature is unambiguously project-specific (e.g. "add Mint Vision logo to invoice header").

---

## 2d Library / framework docs (context7) — conditional

**Triggers:**
- Brainstorm or clarifications name a specific library, framework, or SDK by name (Prisma, Next.js, React Query, Stripe, Anthropic SDK, etc.)
- The feature depends on a specific version of that library

**Cost:** medium. context7's `query-docs` calls cost tokens.

**Outputs:**
- Library + version + key API/pattern + source URL
- Embeds into "Research notes" section of issue

**Why context7 specifically:** training data may be 6+ months stale. context7 is current as of the last index. For library docs, **always prefer context7 over WebSearch** — search results for "how to use library X" are often outdated tutorials.

**Tool calls:**
1. `resolve-library-id` for the library name
2. `query-docs` for the specific feature area

**Skip when:** no specific library is named, or the library is so foundational (HTML, CSS, plain JS) that docs aren't the bottleneck.

---

## 2e Industry standards & best practices (WebSearch) — conditional

**Triggers (4 sub-categories, each with its own micro-trigger):**

### 2e.1 Security-sensitive
**Fires on keywords:** auth, login, password, session, token, secret, encrypt, payment, card, JWT, OAuth, RBAC, permission, MFA, 2FA.

**Sources to consult:**
- OWASP cheat sheets (specifically the Authentication, Session Management, Authorization, Cryptographic Storage cheat sheets)
- NIST 800-63 series for digital identity
- CVE database for specific libraries

**Query format:** `OWASP <topic> cheat sheet`, `NIST 800-63 <topic>`, `<library> CVE <year>`.

### 2e.2 Compliance-touching
**Fires on keywords:** PHI, PII, payment data, audit, retention, consent, opt-in, opt-out, marketing, healthcare, financial.

**Action:**
- If `repo_schema.compliance_posture` is null/empty: invoke `compliance-research` skill
- If posture exists: spot-check against `docs/compliance/` profile files for currency

**Sources:**
- PHIPA / PIPEDA / HIPAA / GDPR / PCI-DSS / CASL / SOC2 official docs
- Recent regulatory updates (regulations evolve — don't trust training data alone)

**Query format:** `<regulation> <year> <topic> requirement`, `<jurisdiction> <data type> retention rules <year>`.

### 2e.3 Novel UX patterns
**Fires on:** the feature is UX-novel (no obvious precedent in the repo or sibling repos).

**Sources:**
- Nielsen Norman Group
- Domain-specific UX research
- Competitive analysis ("how does Stripe handle X")

**Query format:** `<UX pattern> design conventions <domain>`, `<competitor> <pattern> UX`.

### 2e.4 Performance / scaling
**Fires on:** the feature touches large data sets, real-time updates, caching strategies, pagination, search-at-scale, file uploads, streaming.

**Sources:**
- Stack-specific performance guides (e.g. "Next.js 16 streaming SSR performance")
- Vercel guides for Vercel-hosted apps
- DB-specific guides (Postgres connection pooling, Supabase scaling)

**Query format:** `<stack> <pattern> performance <year>`, `<DB> <operation> at scale`.

---

**Cost:** can be high. WebSearch each call costs tokens; multiple sub-categories compound.

**Cost control:**
- One targeted query per sub-trigger, not exploratory search
- Capture URL + date + key takeaway, not full content
- If a query returns nothing useful, don't retry — note the gap in "Research gaps"

**Output format (per finding):**
```
- **<topic>** — <key takeaway in 1–2 sentences>
  - Source: <URL> (checked <YYYY-MM-DD>)
```

---

## 2f Prototype / mockup awareness — conditional

**Triggers (visual feature signals):** UI, dashboard, form, modal, flow, page, navigation, sidebar, card, layout, button, table.

**Cost:** very low. Two `git`/`gh` commands.

**Steps:**
1. `git branch -a | grep "prototype/"` — list existing prototype branches
2. `gh issue list --label prototype --state all --limit 50` — surface prototype-tagged issues

**Outputs:**
- List of prototype branches that might overlap
- List of prototype-tagged issues that might overlap

**If overlap is plausible:** surface immediately. The right path may be `/extract-prototype-review <branch>` rather than `/spec-it` — `extract-prototype-review` is purpose-built for converting prototype branches into work-issue-ready issues.

**Gate behavior:** if a strong overlap is found, ask the user via `AskUserQuestion` whether to redirect to `/extract-prototype-review`. If they decline, continue with `/spec-it` and note the prototype branch as a Visual Spec reference in the issue body.

---

## 2g Synthesis — Impact map (always, last)

**Why always:** every stream's output needs to converge into a single artifact that Phase 3 can act on.

**Cost:** low. Mostly aggregation, no new tool calls.

**Output:** `<repo>/.claude/spec-it/<run-id>/impact-map.md` with the structure:

```markdown
# Impact map — <feature title>

## Specs affected
- <path> § <section>: <change summary>
- ...

## Code anchors
- `<file>` — <one-line reason>
- ...

## Similar past features
- #<N>: <title> — <PR link>
- ...

## Memory hits
- <type> memory: <one-line summary> (relevant to <area>)
- ...

## External findings

### Library docs
- <library>@<version> — <takeaway> ([source](<url>), <date>)

### Industry standards
- <standard> — <takeaway> ([source](<url>), <date>)

### Compliance
- <regulation> — <takeaway> ([source](<url>) OR via compliance-research profile <name>, <date>)

### Prior art
- <repo>: `<path>` — <pattern>

## Research gaps
- <question that couldn't be answered>
- ...
```

The Research gaps section is **important** — it tells Phase 3 what to ask the user explicitly.

---

## Cost budget guideline

Aim for total Phase 2 cost under 30k tokens. If a single stream is dominating (typically 2e WebSearch on a security-sensitive feature with 4 sub-triggers), prune:
- Combine adjacent queries where possible
- Skip queries that duplicate sibling-repo prior art
- Defer one sub-category to Phase 3 ("do you want me to also research X?")

The user can always request deeper research via Gate 2 option 2 if Phase 3 reveals a gap.
