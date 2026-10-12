# Contributing

Thanks for your interest in vakto. This guide gets you from clone to merged pull
request.

If you believe you found a security vulnerability, do not open a public issue —
follow [SECURITY.md](SECURITY.md) instead.

## Before you open a pull request

- Read [ADR 0001](docs/adr/0001-supervisor-contract.md). Anything that changes
  state ownership, triggers, authority, leases, or idempotency needs a new
  decision record, not a quiet edit.
- Keep the change small: one slice from [the plan](docs/plan/0001-map.md) or
  less.
- Deployment specifics — host names, endpoint keys, tokens, repository
  allowlists — never belong in this repository. `config.example.json` shows the
  shape; real values live with whoever runs it.

## Development setup

Requires Node `>=24.11.0` (the toolchain's Vitest 5 requires
`^22.18 || ^24.11 || >=26`).

```sh
npm install
```

## Gates

```sh
npm run check   # oxfmt + oxlint + type checks, via Vite+
npm run test    # Vitest
npm run pack    # library build
```

`npm run ci` runs all three in order. CI runs the same commands on Linux and
Windows.

The toolchain is [Vite+](docs/adr/0002-toolchain-vite-plus.md) — `vp` is a
project dependency, so you do not need a global install. If you do have the
global CLI, it delegates to the project's pinned version.

## Code style

Formatting and linting are enforced by `npm run check`; run `npm run check --
--fix` before committing rather than hand-formatting. Two patterns worth
keeping:

- Pure decisions over I/O. If a rule can be expressed as a pure function, put it
  in a pure module with tests and let the I/O call it. `src/contract.ts` is the
  worked example.
- No dependency without a reason. Runtime dependencies need a decision record
  that shows the simpler option failing.

## Tests

Tests live beside the code as `*.test.ts` and import from `vite-plus/test`. A
change to a decision in `src/contract.ts` needs a test that fails without it —
duplicate deliveries, expired leases, and human interference are the cases that
matter most.

## Pull requests

- Describe what changed, what you ran, and what you observed. "Should work" is
  not evidence.
- Note any follow-up you deliberately left out.
- Keep the pull request ready for review rather than a draft, unless a
  repository requirement says otherwise.

## Licence

Contributions are accepted under AGPL-3.0-or-later, inbound matching outbound.
There is no CLA.
