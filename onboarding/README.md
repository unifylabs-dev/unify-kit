<!--
onboarding/README.md
Sourcing mode: pattern-only (per specs/00-vision-and-license.md §"Sourcing modes")
The Ultimate Guide's learning-path/ shape inspires this curriculum; content is original.
License: CC BY-SA 4.0 (narrative docs ship CC BY-SA 4.0 per specs/00-vision-and-license.md §"License")
Authored: 2026-05-04
-->

# Onboarding curriculum

## Overview

This curriculum gets a new dev productive on a project that has adopted `unify-kit`. Pre-requisites: Claude Code installed and signed in; access to the project's GitHub repo; the project's `<consumer>/CLAUDE.md` and its instance of `templates/team-onboarding.md.template` are the source of project-specific specifics — this curriculum covers only what is uniform across kit-adopting projects.

Day-1 starts with [`scripts/init-project.sh`](../scripts/README.md#init-projectsh) against a fresh project — see [`day-1.md`](day-1.md) §0. If a previous dev already bootstrapped the project, the manifest at `<project>/.unify-kit-project-manifest.json` will exist; verify it's current (`init-project.sh <project> --dry-run` reports `no changes needed`) and skip to §1.

## How to use this curriculum

Read in order: `day-1.md` → `week-1.md` → `day-30.md`. Day 1 has a short hard checklist of objectively verifiable artifacts; week 1 and day 30 are soft milestones for self-assessment, not gates the kit enforces.

## Files

- `day-1.md` — get running: machine setup, hooks installed, first PR opened.
- `week-1.md` — internalize the canonical workflows and reviewer choices.
- `day-30.md` — soft retrospective and autonomy markers.

## Customization

Projects can override any phase's checklist by editing their own instance of `templates/team-onboarding.md.template`. The kit's curriculum is the *default*; the project's onboarding is the *truth*.
