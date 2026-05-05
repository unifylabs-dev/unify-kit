<!--
onboarding/day-1.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
License: CC BY-SA 4.0
Authored: 2026-05-04
-->

# Day 1 — Get running, ship something tiny

By end of day 1 you should have a working environment, the right docs read, and one trivial commit/PR shipped. The point isn't shipping the world-changing fix — it's exercising every gate the kit installs, end-to-end, on something low-stakes.

## 1. Set up your machine

Install Claude Code per the official docs at `https://docs.claude.com/claude-code`. Verify the install:

```bash
claude --version
```

You should see a version line. If not, the install didn't succeed — fix that before continuing; nothing below works without a working Claude Code.

Stack-specific install steps (Node, Python, your build tools, etc.) live in your project's `setup_guide.md` or equivalent — read that next.

## 2. Bootstrap your `~/.claude`

From the kit repo (clone it if you haven't):

```bash
./scripts/bootstrap-claude-config.sh
```

This installs the kit's six security hooks into `~/.claude/hooks/` and registers them in `~/.claude/settings.json`. The script is idempotent — re-runs are safe — and creates a backup before modifying anything. If you hit a merge conflict between an existing hook entry and the kit's, the script tells you and exits without writing.

Then confirm the install:

```bash
./scripts/audit-scan.sh ~/.claude/settings.json
```

Expect exit 0 and zero `critical` findings. Anything `critical` means the bootstrap left you in an unsafe state — escalate to your lead before continuing.

## 3. Required reading (~90 minutes total)

In order:

- The project's `<consumer>/CLAUDE.md` start-to-finish — this is the project's memory file; everything in it constrains how Claude Code behaves on this codebase.
- The project's `docs/architecture.md` (or equivalent) — the system overview, so you know which subsystem you're in when you read code later.
- The kit's `templates/cheatsheet.md.template` — the command vocabulary you'll use daily (8 commands), the daily skills, the context-discipline thresholds, and the reviewer mapping (Appendix A).
- The kit's `templates/ai-usage-charter.md.template` — what's permitted, what isn't, and the hard rule that AI-generated code passes the same review as human code.

If you only have 30 minutes, read `<consumer>/CLAUDE.md` and the cheatsheet. Skim the rest. You'll re-read all four in week 1 anyway.

## 4. Verify your tooling

- Open Claude Code in this repo. Confirm the `using-superpowers` skill loads — that's the signal that the superpowers plugin is enabled.
- Run `/help` and skim the available commands. You don't need to memorize them; the cheatsheet is the daily reference.
- Verify a hook fires: try

  ```bash
  rm -rf /tmp/test-blocked-by-hook
  ```

  in a Claude Code session. The `dangerous-actions-blocker.sh` hook should block it. If it doesn't, the hooks aren't actually installed — go back to step 2.

## 5. Ship something trivial

- Pick a `good-first-issue` ticket from the project's GitHub issues, or fix a typo in docs.
- Run `/work-issue <N>` end-to-end: analysis → branch → planning → TDD if applicable → verification → review prep → review → PR.
- Open the PR. Confirm `/claude-review` posts a tiered review comment (🔴 / 🟡 / 🟢) within a few minutes. The Action runs on comment trigger only — if no comment appears, invoke it explicitly with `/claude-review` in a PR comment.

The trivial fix is the means, not the end. By the time the comment posts you've touched: hooks (step 2), `/work-issue` (step 5), the project's branch and PR conventions (step 5), and `/claude-review` (step 5). That's the kit's whole day-1 surface.

## Day-1 hard gates

Check each one before logging off:

- [ ] `bootstrap-claude-config.sh` exits 0 — output captured in your terminal
- [ ] `audit-scan.sh ~/.claude/settings.json` exits 0 with zero `critical` findings
- [ ] First PR opened against the project repo (any branch with at least one committed change)
- [ ] `/claude-review` invoked on that PR and a tiered review comment is posted

These four are objectively verifiable. If any is missing, day 1 isn't complete — fix it before moving to week 1. The hard gates are deliberately short — four items, all artifact-based, all enforceable by a glance at git or the terminal.

## Day-1 soft guidance

Encouraged, not gated:

- Read `<consumer>/CLAUDE.md` (yes, end-to-end — see step 3).
- Join the team's communication channel.
- Pair with a senior on your first ticket if available.

These items used to be in the hard list but didn't survive the "objectively verifiable" filter — there's no command that confirms you've read CLAUDE.md or joined the channel. They're still load-bearing for the rest of week 1, just not gate-able.
