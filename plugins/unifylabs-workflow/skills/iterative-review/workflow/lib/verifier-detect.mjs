// verifier-detect.mjs — pure verifier-command resolution (P3 wrapper foundation).
//
// Encodes references/verifier-detection.md's detection table. PURE: it takes the
// already-read project file CONTENTS (no fs, no probing) and returns the ordered
// list of verifier command strings. The agent-backed glue is responsible for
// reading the files off disk and handing their contents in; keeping this pure is
// what makes it unit-testable with deterministic fixtures.
//
// Input shape (all fields optional):
//   {
//     packageJson:   <string|object>  // raw text OR parsed package.json
//     pyprojectToml: <string>         // raw pyproject.toml text
//     lockfiles:     <string[]>       // filenames present (pnpm-lock.yaml, ...)
//     otherFiles:    <string[]>       // filenames present (Cargo.toml, go.mod,
//                                     //   Makefile, requirements.txt, Gemfile,
//                                     //   setup.cfg, and dir markers
//                                     //   'tests/' / 'spec/')
//     makefile:      <string>         // raw Makefile text (for test:/check: targets)
//   }
//
// Output: ordered, de-duplicated array of command strings. Empty array when
// nothing matched (the glue then AskUserQuestions for commands).
//
// Determinism: pure. No wall-clock, no random, no i/o.

/**
 * Pick the JS package manager prefix from the lockfiles present. npm is the
 * default; a present lockfile swaps it. Precedence is fixed (deterministic):
 * pnpm > yarn > bun > npm — first present wins.
 * @param {string[]} lockfiles
 * @returns {{ runner: string, test: string }}
 */
function jsRunner(lockfiles) {
  const have = new Set(lockfiles ?? []);
  if (have.has('pnpm-lock.yaml')) return { runner: 'pnpm', test: 'pnpm test --silent' };
  if (have.has('yarn.lock')) return { runner: 'yarn', test: 'yarn test --silent' };
  if (have.has('bun.lockb') || have.has('bun.lock')) {
    return { runner: 'bun', test: 'bun test --silent' };
  }
  return { runner: 'npm', test: 'npm test --silent' };
}

/**
 * Parse the package.json scripts block from raw text or an already-parsed object.
 * Returns a plain object of scriptName -> command, or {} on any failure (never
 * throws — a malformed package.json simply yields no JS verifiers).
 * @param {string|object|undefined} pkg
 * @returns {Record<string,string>}
 */
function parseScripts(pkg) {
  if (pkg == null) return {};
  let obj = pkg;
  if (typeof pkg === 'string') {
    try {
      obj = JSON.parse(pkg);
    } catch {
      return {};
    }
  }
  if (typeof obj !== 'object' || obj === null) return {};
  const scripts = obj.scripts;
  if (typeof scripts !== 'object' || scripts === null) return {};
  return scripts;
}

/**
 * Resolve the ordered verifier command list from project file contents.
 * @param {object} projectFiles
 * @returns {string[]}
 */
export function resolveVerifier(projectFiles = {}) {
  const {
    packageJson,
    pyprojectToml,
    lockfiles = [],
    otherFiles = [],
    makefile,
  } = projectFiles;

  const out = [];
  const push = (cmd) => {
    if (cmd && !out.includes(cmd)) out.push(cmd);
  };

  // --- JS / Node ecosystem (package.json + lockfile-derived runner) --------
  const scripts = parseScripts(packageJson);
  const haveScripts = Object.keys(scripts).length > 0 || packageJson != null;
  if (haveScripts) {
    const { runner, test } = jsRunner(lockfiles);
    // Order matches the detection table: test, typecheck, build, lint.
    if (scripts.test) push(test);
    if (scripts.typecheck) push(`${runner} run typecheck`);
    if (scripts.build) push(`${runner} run build`);
    if (scripts.lint) push(`${runner} run lint`);
  }

  // --- Python (pyproject.toml sections) ------------------------------------
  if (typeof pyprojectToml === 'string') {
    if (pyprojectToml.includes('[tool.pytest')) push('pytest -x --tb=short');
    if (pyprojectToml.includes('[tool.mypy')) push('mypy .');
    if (pyprojectToml.includes('[tool.ruff')) push('ruff check');
  }

  // --- Legacy Python (setup.cfg / requirements.txt + tests/ dir) -----------
  const others = new Set(otherFiles);
  const hasLegacyPy = others.has('setup.cfg') || others.has('requirements.txt');
  if (hasLegacyPy && others.has('tests/')) push('pytest -x');

  // --- Rust ----------------------------------------------------------------
  if (others.has('Cargo.toml')) {
    push('cargo test --quiet');
    push('cargo check');
  }

  // --- Go ------------------------------------------------------------------
  if (others.has('go.mod')) {
    push('go test ./...');
    push('go vet ./...');
  }

  // --- Ruby ----------------------------------------------------------------
  if (others.has('Gemfile') && others.has('spec/')) push('bundle exec rspec');

  // --- Makefile targets ----------------------------------------------------
  if (typeof makefile === 'string') {
    if (/^test:/m.test(makefile)) push('make test');
    if (/^check:/m.test(makefile)) push('make check');
  }

  return out;
}
