---
name: extract-prototype-review
description: >
  Extract acceptance criteria and visual specs from a *sanctioned* prototype
  branch (under `prototype/*`, with a Draft PR + screenshots, where the junior
  intentionally skipped auth/validation/tests per CLAUDE-PROTOTYPE.md) and
  create a GitHub issue for `/work-issue` to implement. Use when the user says
  "/extract-prototype-review <branch>" with a prototype branch name. For
  non-prototype external branches that need standards-compliance auditing
  and routing (salvage / rebuild / discard), use `/integrate-branch` instead.
  (Formerly `/review-prototype` — renamed to clarify scope: this skill
  *extracts specs from* a prototype; `/integrate-branch` is the true
  *review-and-integrate* skill.)
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Agent
---

# /extract-prototype-review

You are reviewing a prototype branch to extract testable acceptance criteria and create a GitHub issue that `/work-issue` can pick up seamlessly.

## Input

The user provides a branch name: `/extract-prototype-review <branch>`

Accepted formats:
- `prototype/42-customer-search-modal` (full branch name)
- `42-customer-search-modal` (without prefix — prepend `prototype/` automatically)
- `customerdashboardredesign` (non-standard name — use as-is if it exists on remote)

If the input looks like a bare number (e.g., `/extract-prototype-review 42`), stop and tell the user:
```
This skill now takes a branch name, not an issue number.
Usage: /extract-prototype-review prototype/42-customer-search-modal
```

## Phase 1: Gather

Collect all context about the prototype.

### Resolve the branch name

```bash
git fetch origin

# Try exact match first
git rev-parse --verify origin/<branch> 2>/dev/null

# If not found and input lacks "prototype/" prefix, try with prefix
git rev-parse --verify origin/prototype/<branch> 2>/dev/null

# If still not found, search for partial matches
git branch -r --list "origin/prototype/*<input>*"
git branch -r --list "origin/*<input>*"
```

If no branch is found, stop and tell the user:
```
Branch '<branch>' not found on remote.

Did you mean one of these?
  <list of partial matches>

If the branch is local-only, push it first: git push origin <branch>
```

Once resolved, store the **canonical branch name** (e.g., `prototype/42-customer-search-modal`) for all subsequent steps.

### Check for associated PR

```bash
gh pr list --head "<branch>" --state all --json number,title,body,url --limit 1
```

If a PR exists, extract its title and body as supplementary context. The PR description may contain design intent, known limitations, or requirements not visible in the code.

### Get the diff

```bash
# Full diff against master (excluding package-lock)
git diff master...origin/<branch> -- . ':!package-lock.json'

# List all changed files
git diff master...origin/<branch> --name-only

# File stats
git diff master...origin/<branch> --stat
```

### Read changed files

For each changed file in the diff, read the full file from the prototype branch:

```bash
git show origin/<branch>:<path-to-file>
```

Read every changed file. Do not skip any — even config files, styles, and test stubs contain behavioral signals.

## Phase 2: Analyze

Read every changed file in the prototype. For each file, document:

### Behavior Inventory
List observable behaviors — what the prototype DOES (not how it's coded):
- UI elements and interactions (buttons, forms, modals, navigation)
- Data operations (create, read, update, delete)
- Business rules (conditions, calculations, status transitions)
- User workflows (multi-step processes, wizards)

### Implied Business Rules
Rules that the prototype implements but may not be explicitly stated:
- Validation logic (required fields, formats, ranges)
- Access control (who can do what)
- State machines (status flows, transitions)
- Calculations (pricing, totals, dates)

### Gaps (Not Carried Forward)
Things the prototype skips that the production version needs:
- Auth guards (verifySession/verifyRole)
- Input validation (Zod schemas)
- Error handling
- Audit logging
- Rate limiting (if public-facing)
- Tests
- Accessibility
- Mobile responsiveness (if applicable)

### Title & Type Inference
From the analysis, determine:
1. **Title** — a descriptive title (under 70 chars) summarizing the feature. Derive from branch name + behavioral analysis. Do NOT prefix with `[Feature]:` or similar.
2. **Type** — `feature` (new capability) or `enhancement` (improvement to existing). If the prototype fixes broken behavior, use `bug` (rare for prototypes).
3. **Area** — which `area:*` label applies (e.g., `area:customers`, `area:orders`). Pick the primary area; omit if unclear.

## Phase 2.5: Visual Specification Extraction

**Goal:** Capture every visual detail from the prototype as structured, machine-readable specs that the implementation must reproduce exactly. Text-based ACs like "User sees a customer list" lose critical visual details — this phase prevents that.

### Step 1: Collect PR screenshots

Check if the Draft PR has screenshots attached:

```bash
# Get PR body (may contain embedded images)
gh pr list --head "<branch>" --state all --json body --limit 1 --jq '.[0].body'

# Get PR comments that may contain images
gh pr list --head "<branch>" --state all --json number --limit 1 --jq '.[0].number' | xargs -I{} gh api repos/:owner/:repo/pulls/{}/comments --jq '.[].body'
```

Look for markdown image references (`![...](...)`) and extract image URLs. If screenshots exist, read them using the Read tool (Claude can read images) and note:
- Layout structure (grid vs flex, columns, sidebar presence)
- Color usage (which elements use which colors)
- Spacing patterns (tight vs spacious, card padding)
- Typography hierarchy (heading sizes, font weights, text colors)
- Component states shown (empty, loading, populated, error)
- Interactive states shown (hover, selected, expanded, modal open)

### Step 2: Extract Visual Spec from source code

For every changed `.tsx`/`.jsx` file, read the prototype source:

```bash
git show origin/<branch>:<path-to-component>
```

For each UI component file, extract a **Visual Spec Block** documenting:

#### Layout Structure
```
Layout: <grid|flex|stack>
  Direction: <row|col>
  Columns: <N or responsive pattern like "grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Gap: <Tailwind gap class, e.g., "gap-4" or "gap-6">
  Container: <max-w-* class or "full-width">
  Padding: <p-* class for the main container>
```

#### Component Visual Specs
For each distinct UI element (card, table, form, modal, header, etc.):
```
Component: <name>
  Container classes: "<exact Tailwind classes from prototype>"
  Heading: "<text-* font-* classes>"
  Body text: "<text-* classes>"
  Spacing (internal): "<p-* or space-y-* classes>"
  Border/shadow: "<border-* shadow-* rounded-* classes>"
  Colors: "<bg-* text-* classes>"
  Icon: "<library and icon name, size classes>"
  Interactive states:
    Hover: "<hover:* classes>"
    Disabled: "<disabled:* classes>"
    Active/selected: "<classes applied on active state>"
```

#### Page-Level Measurements
```
Page padding: <exact class, e.g., "p-6" or "px-4 py-6">
Section spacing: <exact class between major sections, e.g., "space-y-8">
Header area: <classes for page title/breadcrumb area>
Content area: <max-width constraint if any>
```

#### Inline Style Conversions
If the prototype uses inline styles (`style={{...}}`), convert to Tailwind equivalents:
```
Inline: style={{ marginTop: '24px' }} → Tailwind: mt-6
Inline: style={{ color: '#16a34a' }} → Tailwind: text-green-600
Inline: style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }} → Tailwind: grid grid-cols-3
```

### Step 3: Document interactive states

For each interactive element in the prototype source:

```
Element: <button/modal/dropdown/tab/etc.>
  Default state: <classes>
  Hover state: <hover:* classes or JS-driven class changes>
  Active/pressed: <active:* classes>
  Disabled: <disabled:* classes>
  Loading: <visual changes — spinner, opacity, text>

  Modal/dialog (if applicable):
    Trigger: <what opens it>
    Overlay: <bg-black/50 or similar>
    Container: <max-w-*, rounded-*, shadow-* classes>
    Animation: <transition classes if present>
    Close: <X button position, ESC key handling>
```

### Step 4: Handle multi-page/multi-state prototypes

If the prototype modifies multiple pages or shows different states:

```
Route: /path/to/page
  States documented:
    - Empty state: <what shows when no data, with classes>
    - Populated state: <normal view with data>
    - Loading state: <skeleton/spinner>
    - Error state: <error message display>

  Responsive breakpoints (if prototype shows them):
    - Mobile (<640px): <layout changes>
    - Tablet (640-1024px): <layout changes>
    - Desktop (>1024px): <default layout>
```

### Step 5: Extract color and token usage

Map all colors to project design tokens:

```
Color mapping:
  bg-white → card background (standard)
  text-gray-900 → primary text
  text-gray-500 → secondary/muted text
  text-primary → brand accent (green)
  border-gray-100 → card borders (light)
  <...etc.>

Non-standard colors (prototype-specific):
  <any color not in the standard palette — flag for design review>
```

### Step 6: Compile

Compile all findings into a structured Visual Specification section for the GitHub issue. This is NOT optional commentary — it is a binding contract that `/work-issue` must follow with the same fidelity as behavioral acceptance criteria.

---

## Phase 3: Generate Acceptance Criteria

Convert the behavior inventory into testable ACs in checkbox format:

```
- [ ] <Actor> can <action> when <condition>
- [ ] System <validates/calculates/transitions> <what> when <trigger>
- [ ] <Error state> is shown when <invalid condition>
```

Rules for good ACs:
- Each AC is independently testable
- Use specific, observable outcomes (not "works correctly")
- Include validation ACs (what happens with bad input)
- Include auth ACs (who can/cannot access)
- Include edge cases visible in the prototype
- Order: happy path first, then validation, then edge cases
- Group into logical sub-sections with `### Sub-heading` when there are more than 10 ACs
- Always include production-quality ACs the prototype omits: auth guards, audit logging, input validation, error handling

### Visual Acceptance Criteria

In addition to behavioral ACs, generate explicit visual ACs from the Phase 2.5 analysis. Group them under a `### Visual Fidelity` sub-heading:

```
### Visual Fidelity
- [ ] Page layout uses <exact layout structure with Tailwind classes from prototype>
- [ ] Card/container styling: <exact classes, e.g., "bg-white rounded-xl border border-gray-100 shadow-sm p-5">
- [ ] Typography hierarchy: <heading classes> for titles, <body classes> for content
- [ ] Spacing: <page padding>, <section gap>, <card internal padding>
- [ ] Color usage: <specific color tokens per element type>
- [ ] Interactive states: hover/disabled/loading states match prototype
- [ ] Empty states: <description of empty state UI with classes>
- [ ] Icons: <library, specific icons, sizes>
```

Rules for visual ACs:
- Every visual AC MUST reference specific Tailwind classes or design tokens — never "looks similar to prototype"
- If the prototype uses non-standard patterns that conflict with project conventions (CLAUDE.md), note the conflict and recommend the convention
- If the prototype uses inline styles, the visual AC should reference the Tailwind equivalent (from Phase 2.5 conversion)

## Phase 4: Create GitHub Issue

Create a new GitHub issue with all extracted details. The issue body MUST use a `## Acceptance Criteria` section with `- [ ]` checkboxes — this is the format `/work-issue` parses.

### Determine labels

Build the label list:
- `ready-for-implementation` (always)
- Type label: `feature` or `enhancement` or `bug` (from Phase 2 inference)
- Area label if determined (from Phase 2)

### Create the issue

```bash
gh issue create \
  --title "<title from Phase 2>" \
  --label "ready-for-implementation,<type-label>" \
  --body "$(cat <<'ISSUE_BODY'
## Description

<2-4 paragraph narrative description of what the prototype does and why it's needed.
Include context from the PR description if one was found.
End with: "Extracted from prototype branch `<branch>`.">

## Acceptance Criteria

### Behavior
<Group behavioral ACs under sub-headings as needed>
- [ ] AC 1
- [ ] AC 2
- [ ] AC 3

### Visual Fidelity
- [ ] Page layout uses <exact layout structure with Tailwind classes>
- [ ] Card/container styling: <exact classes from prototype>
- [ ] Typography: <heading classes> for titles, <body classes> for content
- [ ] Spacing: <page padding>, <section gap>, <card padding classes>
- [ ] Colors: <specific color tokens per element type>
- [ ] Interactive states: <hover/disabled/loading classes from prototype>
- [ ] Empty/loading states: <description with classes>
- [ ] Icons: <library, names, sizes>

## Visual Specification

<Compiled from Phase 2.5. For each page/route in the prototype:>

### Page: <route>

#### Layout
<Layout structure: grid/flex, columns, gap, container, padding>

#### Components
<For each distinct UI component — the full visual spec block from Phase 2.5 Step 2.
Include exact Tailwind classes for container, text, spacing, borders, colors, icons.>

#### Interactive States
<Default/hover/active/disabled for each interactive element.
Include modal specs if applicable.>

#### Color Map
<All colors mapped to project design tokens. Flag non-standard colors.>

<Repeat ### Page: <route> for each page in the prototype>

## Prototype Source Reference

Key component files — use `git show origin/<branch>:<path>` to read during implementation:

| File | Purpose | Visual elements |
|------|---------|-----------------|
| `src/app/(portal)/feature/page.tsx` | Main page | Layout, data grid |
| `src/components/feature/FeatureCard.tsx` | Card component | Card styling, badges |

## Implementation Notes

<Technical observations for /work-issue implementation.>

## Not Carried Forward

<Things NOT to reimplement:
- Hardcoded data that should come from DB
- Inline styles (Tailwind equivalents noted in Visual Spec)
- Missing auth guards (added during implementation)
- Placeholder components that are unused
>

## Prototype Branch

`<branch>` — not to be merged; serves as living spec.
Use `git show origin/<branch>:<file>` to read any prototype file during implementation.
ISSUE_BODY
)"
```

**CRITICAL:** The `## Acceptance Criteria` heading and `- [ ]` checkbox format are non-negotiable — `/work-issue` Phase 1 depends on them.

### Capture the issue number

After creation, `gh issue create` prints the issue URL. Extract the issue number for the handoff.

## Phase 5: Handoff

Tell the user:

```
Issue #<N> created: <URL>

Summary:
  - <X> behaviors extracted
  - <Y> behavioral acceptance criteria
  - <Z> visual fidelity acceptance criteria
  - <W> component visual specs documented
  - Screenshots: <found in PR / not found>
  - Labels: ready-for-implementation, <type>
  - Prototype branch: <branch> (unchanged)

Ready to implement? Run: /work-issue <N>
```

If a Draft PR exists for the branch, mention it so the user knows it's still there as reference.

If no screenshots were found in the Draft PR, add this warning:
```
⚠️ No screenshots found in the Draft PR. Visual fidelity depends on source code analysis only.
   Ask the prototype author to add screenshots to the Draft PR description.
   This gives /work-issue a visual ground truth to verify against.
```

## Important Notes

- Never modify the prototype branch
- Never merge or close any Draft PR associated with the branch
- If the prototype is too rough to extract meaningful ACs, say so and ask the user to clarify intent
- If the branch doesn't exist, stop and tell the user — do not create an empty issue
