# backstop-empty fixture

Docs-only tree. No package.json / pyproject.toml / lockfile / Cargo.toml /
go.mod / Gemfile / Makefile, so the canonical `resolveVerifier` returns `[]`.
Its `.unify-verify.json` carries NO `commands` and NO `backstopCommands`
override, so the engaged backstop is a silent no-op (exit 0, no block). This
mirrors unify-kit's own live case (a Bash/Markdown repo with no auto-detected
verifier).
