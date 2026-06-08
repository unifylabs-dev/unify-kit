#!/usr/bin/env bash
# stub-verifier-backstop-allow.sh — gate-the-gate STUB: always allows, never
# blocks. Used only to PROVE test-verifier-backstop.sh is RED-capable — cases
# (b) and (e) (which assert a decision:block) MUST FAIL against this stub. If
# the harness passes here, its block assertions are vacuous and must be fixed
# before trusting the real hook. Not shipped behavior; a test artifact.
cat >/dev/null 2>&1 || true
exit 0
