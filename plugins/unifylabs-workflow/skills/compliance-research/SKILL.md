---
name: compliance-research
description: Interactive compliance profile selection + gap analysis. Walks user through industry, geography, data classes, and customer geography to recommend a compliance profile (baseline-pipeda, healthcare-phipa, financial-canada, general-soc2). Uses context7 + WebSearch to ground on current regulations (compliance evolves; cannot rely on training data alone). Gap-analyzes existing docs/compliance/ against the recommended profile and writes docs/compliance/research-notes/<date>-<topic>.md. Use when the user says "/compliance-research", "what compliance profile should I use", or starts a new regulated project.
---

# compliance-research

Implementation completed in phase 3 of the unify-kit v2 reshape run (`2026-05-12-unify-kit-v2`).

This stub exists so the skill registry picks up the slot in phase 1 (plugin scaffolding). Phase 3 replaces the body with the full interactive flow.
