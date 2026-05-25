---
name: 2026-05-24-recreate-tasklist-fixture
description: Static fixture for recreate-tasklist.sh tests
metadata:
  type: session-handoff
  mode: generic
  tier: full
  status: pending
---

# Session Handoff — recreate-tasklist fixture

## §5 TaskList snapshot

- [pending] fetch user records — Query users by tenant_id
- [in_progress] validate schema — Run zod against fetched records
- [pending] apply transformation — Map records into export format

## §6 Do-not-re-litigate

(unused by this script)
