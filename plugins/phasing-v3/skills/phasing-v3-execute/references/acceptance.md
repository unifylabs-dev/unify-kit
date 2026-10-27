# Acceptance rows

`acceptance.json` in the run folder holds one row per requirement. It is JSON on purpose: models
are less likely to rewrite or drop rows in JSON than in Markdown.

| Field | Meaning |
|---|---|
| `id` | A short unique id, for example `P2-04`. |
| `requirement` | What must be true, in one sentence a user can check. |
| `phase` | The phase that owns the row now. |
| `status` | `open`, `met` or `dropped`. |
| `evidence` | How it was shown: a test name, a CI run, a screenshot path, a command and its output. Required for `met`. |
| `carried_from` | The phase the row came from if it was carried, otherwise `null`. |
| `deadline_phase` | The last phase by which the row must be met, or `null`. |

A new row, as `/ph3` writes it:

```json
[
  { "id": "P1-01", "requirement": "The app deploys to its preview URL from the base branch.", "phase": 1,
    "status": "open", "evidence": "", "carried_from": null, "deadline_phase": null }
]
```

`evidence` is always a string, empty while the row is open. Every phase owns at least one row, so
every phase has something to check.

## Rules

- "Deferred" is not a status. A row is open, met, or dropped.
- A `met` row has evidence. "Looks right" is not evidence.
- Only the user drops a row. Record why in the evidence field.
- A row carries once, one phase forward, and only between phases with the user's agreement.
  Executors do not carry their own rows: an open row makes the phase `partial` or `failed`.
- A carried row sits in the phase after its origin, with `carried_from` set to that origin and
  `deadline_phase` equal to its new phase.
- No row sits past the run's last phase.

## Helper

`node <plugin>/scripts/acceptance.mjs check <run-dir> <N>` validates the file and reports this
phase's rows. It is optional; the rules above are what count.
