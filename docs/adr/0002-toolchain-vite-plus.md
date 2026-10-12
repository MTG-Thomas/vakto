# Toolchain: Vite+

Status: accepted · Date: 2026-10-12 · Supersedes: none

## Context

A new repository needs a formatter, a linter, a type checker, a test runner, and
a library build, plus whatever wiring keeps them consistent between a developer
machine, CI, and another contributor's machine. Assembling that from separate
tools is a maintenance surface that has nothing to do with what this project is
about, and it is the part that most often drifts between environments.

Vite+ (`vite-plus`) bundles Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and a
task runner behind one `vp` CLI, under the MIT licence. It is young — 1.1.0 at
the time of this decision, previously alpha — so the choice is optimistic about
its direction and has to be cheap to reverse.

## Decision

Use Vite+ for formatting, linting, type checks, tests, and library packaging.

1. **Project-local, not machine-global.** `vite-plus` is a `devDependency`, and
   `package.json` scripts call `vp`. Contributors need no global install, and
   CI runs the same pinned toolchain as a developer. A global `vp` install
   delegates to the project's version, so it stays optional.
2. **`vp check` is the single static gate.** It runs Oxfmt, Oxlint, and type
   checks together, configured in `vite.config.ts` with `typeAware` and
   `typeCheck` on, and the TypeScript project comes from `tsconfig.json`.
3. **One config file.** Lint, format, test, and pack configuration live in
   `vite.config.ts`; `vitest.config.ts` and `tsdown.config.ts` are not used.
4. **Tests import from `vite-plus/test`.** Vitest is bundled; adding a direct
   `vitest` dependency risks two copies of its internals, so imports go through
   the Vite+ entry point.
5. **Node baseline is `>=24.11.0`.** The bundled Vitest 5 supports
   `^22.18 || ^24.11 || >=26`; pinning the higher of the two keeps CI, docs, and
   `engines` in agreement rather than implying support we never test.
6. **CI uses `voidzero-dev/setup-vp` pinned to an exact release.** It sets up
   the toolchain, Node, the package manager, dependencies, and caching, so the
   workflow has no separate Node/cache/install steps.
7. **The package-manager overrides in the Vite+ manual-install guidance are
   not applied.** They exist so third-party packages that import `vite` or
   `vitest` directly resolve the same copies. This repository has no such
   dependency; adding overrides now would be cargo cult. Revisit when a
   dependency imports either package.

## Consequences

- **Reversibility.** The dependency is a dev dependency and the commands are
  aliases in `package.json`. Replacing the toolchain means editing scripts, one
  config file, and one workflow step; no runtime code depends on Vite+.
- **Velocity risk.** Vite+ moved from alpha to 1.x recently. A breaking change
  in a minor release costs a `npm run check --fix` plus a workflow pin update,
  which is why the exact CI action version is pinned and Dependabot/Renovate
  handles the rest. If it becomes a source of churn rather than a saving, this
  record is superseded rather than defended.
- **Node baseline raised.** Contributors on Node 22 must move to 24.11+ or use a
  runtime manager. Accepted for a pre-release project with no users.
- **`vp test` does not watch by default**, unlike Vitest. Use `vp test watch`.
  Scripts named `test` in `package.json` are not run by `vp test`; use
  `vp run test` for those.
- **`vp pack` output is ESM only** unless `format` is configured, which the
  `exports` map in `package.json` must match — vite-plus emits `.mjs`/`.d.mts`.

## Alternatives considered

- **Separate tools (Prettier, ESLint, `tsc --noEmit`, `node:test`, `tsc` build).**
  Rejected: five configurations to keep consistent, and the slowest option for
  the same result.
- **Vitest + tsc directly, without the rest of Vite+.** Rejected: it solves the
  test and type surfaces but leaves formatting, linting, and packaging to be
  chosen separately, which is the cost we are avoiding.
- **Global `vp` as the only install path.** Rejected: it makes CI and
  contributor machines depend on a machine-level tool whose version is not
  recorded in the repository, and it manages Node and package managers by
  default, which is a bigger footprint than this project needs.

## References

- Vite+ documentation — <https://viteplus.dev/guide/>
- `setup-vp` for CI — <https://github.com/voidzero-dev/setup-vp>
- [Supervisor contract](0001-supervisor-contract.md)
