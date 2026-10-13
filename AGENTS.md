# AGENTS.md

Operating notes for agents working in this repository.

## What this repository is

The supervisor described in [ADR 0001](docs/adr/0001-supervisor-contract.md):
it watches a work board, claims items, dispatches agent lanes, and reports
evidence. It is FOSS and deliberately generic — no host names, endpoint keys,
credentials, repository allowlists, or policy that belongs to a deployment.

**Rule:** deployment specifics never enter this repository. They live in
`config.json` (see [`config.example.json`](config.example.json)) or in the
private configuration of whoever runs it. A pull request that hard-codes an
internal host, endpoint key, token, or allowlist is wrong even if it works.

## Gates

Run these before opening a pull request; CI runs the same commands on Linux and
Windows.

```sh
npm install
npm run ci        # vp check + vp test + vp pack
```

A pull request states what it ran and what it observed. "Should work" is not
evidence.

The toolchain is Vite+ ([ADR 0002](docs/adr/0002-toolchain-vite-plus.md)): `vp`
is a project dependency, so no global install is needed, and `vp check` is the
single static gate (format, lint, type checks).

## Conventions

- **Language**: TypeScript on Node 24.11+, ESM, no runtime dependencies unless a
  decision record justifies one. Tests use Vitest through `vite-plus/test`
  (never a direct `vitest` dependency) and run against the TypeScript sources
  directly. Configuration lives in `vite.config.ts`, not in tool-specific config
  files.
- **Coordination rules**: [ADR 0003](docs/adr/0003-coordination-lessons.md) is
  the reference for dispatch lifecycle, leases, isolation, and takeover, and
  [ADR 0004](docs/adr/0004-internalized-rules.md) binds the six rules
  internalized from adjacent packages — wake content, wake suppression,
  reconcile scope, silent writes, the two stop verbs, and channel-scoped
  authority. Four are easy to violate by accident: a lease gates dispatch and is
  never a lock; lanes are described by capability, never by agent product; the
  wake prompt is a fixed template and never quotes work content; and tests use a
  fake board and a fake lane, never a live one.
- **Decisions**: `docs/adr/NNNN-short-slug.md`. Changing anything in ADR 0001 —
  state ownership, trigger, authority, lease semantics, idempotency — requires a
  new decision record that supersedes it, not an edit in place.
- **Plans**: `docs/plan/NNNN-short-slug.md`. A map is an index; detail belongs in
  the slice or the linked artifact.
- **Notes**: `docs/notes/short-slug.md` — surveys, prior art, and recorded
  measurements. A note is not a decision. If a note changes a rule, that change
  belongs in a decision record, and the note should say which one.
- **Licence**: AGPL-3.0-or-later. Contributions are inbound under the same
  terms; there is no CLA.
- **Scars**: anything painful learned while building this belongs in ADR 0001's
  consequences section or in a new record, not in a comment thread.

## Working style

- Small, reviewable pull requests, each one slice or less.
- Prefer a tested pure function over an abstraction. `src/contract.ts` exists
  because that logic must be provable without a board, a network, or a host.
- Never invent an operating path: if the contract does not say what happens,
  that is a decision to record, not a detail to improvise.
- Do not add a dependency, a service, or a queue without a decision record that
  shows the simpler option failing — and check ADR 0003's adoption triggers
  first, since most of those additions already have a named trigger.
- Documentation describes shipped behaviour. No examples that imply something
  the code does not do, no command dumps, no narrative of how the project got
  here.
