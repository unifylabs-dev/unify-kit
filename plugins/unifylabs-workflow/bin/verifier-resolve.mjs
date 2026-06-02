#!/usr/bin/env node
// verifier-resolve.mjs — thin on-disk shim around the canonical verifier
// resolver. Reads a project's verifier-relevant files off disk in the given
// working directory, hands their CONTENTS to the PURE resolveVerifier (the one
// canonical resolver — this shim must NEVER reimplement detection logic), and
// prints {"commands":[...]} as a single JSON line on stdout.
//
// Sourcing mode: customization (per specs/00-vision-and-license.md §"Sourcing modes")
// Authored: 2026-06-02
// License: MIT (per unify-kit LICENSE)
//
// Contract:
//   node verifier-resolve.mjs <workingDir>
//   -> stdout: {"commands":["npm test --silent", ...]}  (possibly empty array)
//   -> exit 0 on success; non-zero on a usage/IO error so the caller can
//      fail-open. The verifier-backstop.sh hook treats any non-zero exit (or
//      missing node) as a silent no-op.
//
// DRIFT GUARD: this file IMPORTS the resolver from the canonical
// lib/verifier-detect.mjs and never re-declares it locally. CI greps for the
// import line AND asserts no local definition (a line-leading function keyword
// followed by the resolver name) — plugin-install-fixture.yml. Keep it that way.
//
// Determinism: the resolver is pure; this shim adds only fs reads (no
// wall-clock, no random) so the resolved command list is a deterministic
// function of the on-disk tree.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { resolveVerifier } from '../skills/iterative-review/workflow/lib/verifier-detect.mjs';

/**
 * Read a file's text, or undefined if absent/unreadable (never throws).
 * @param {string} path
 * @returns {string|undefined}
 */
function readTextOrUndefined(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * True iff `path` exists and is a directory.
 * @param {string} path
 * @returns {boolean}
 */
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Build the projectFiles shape resolveVerifier expects from the on-disk tree
 * rooted at workingDir. Mirrors the input contract documented at the top of
 * lib/verifier-detect.mjs: packageJson/pyprojectToml text, lockfile filenames,
 * otherFiles filenames (+ 'tests/'/'spec/' dir markers), makefile text.
 * @param {string} workingDir
 * @returns {object}
 */
function collectProjectFiles(workingDir) {
  const lockCandidates = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', 'package-lock.json'];
  const fileMarkers = ['Cargo.toml', 'go.mod', 'Gemfile', 'requirements.txt', 'setup.cfg'];
  const dirMarkers = ['tests', 'spec'];

  const lockfiles = lockCandidates.filter((f) => existsSync(join(workingDir, f)));

  const otherFiles = [];
  for (const f of fileMarkers) {
    if (existsSync(join(workingDir, f))) otherFiles.push(f);
  }
  // Dir markers are reported with a trailing slash (the resolver matches
  // 'tests/' / 'spec/').
  for (const d of dirMarkers) {
    if (isDir(join(workingDir, d))) otherFiles.push(`${d}/`);
  }

  return {
    packageJson: readTextOrUndefined(join(workingDir, 'package.json')),
    pyprojectToml: readTextOrUndefined(join(workingDir, 'pyproject.toml')),
    lockfiles,
    otherFiles,
    makefile: readTextOrUndefined(join(workingDir, 'Makefile')),
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write('usage: verifier-resolve.mjs <workingDir>\n');
    process.exit(2);
  }
  const workingDir = resolve(arg);
  if (!isDir(workingDir)) {
    process.stderr.write(`not a directory: ${workingDir}\n`);
    process.exit(3);
  }
  const projectFiles = collectProjectFiles(workingDir);
  const commands = resolveVerifier(projectFiles);
  process.stdout.write(`${JSON.stringify({ commands })}\n`);
}

main();
