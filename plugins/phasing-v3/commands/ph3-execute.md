---
name: ph3-execute
description: Run one phase of a phasing-v3 run.
argument-hint: <run-id> <N>
disable-model-invocation: true
---

The user, or a phase launch, invoked `/ph3-execute` with: `$ARGUMENTS`

Read the arguments as `<run-id> <N>`. If either is missing, or `<N>` is not a whole number, reply
with this and stop:

```text
Usage: /ph3-execute <run-id> <N>
Example: /ph3-execute 2026-11-02-billing 2
```

Otherwise, use the `phasing-v3-execute` skill to run phase `<N>` of run `<run-id>`.
