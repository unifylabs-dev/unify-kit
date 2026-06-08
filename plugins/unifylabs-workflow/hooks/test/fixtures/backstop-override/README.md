# backstop-override fixture

Docs-only tree (no auto-detectable verifier), so `resolveVerifier` returns
`[]`. Its `.unify-verify.json` supplies an explicit `commands` override array
whose single command exits non-zero — proving the override path runs even when
auto-detection finds nothing, and that a failing override command produces a
`decision:block`.
