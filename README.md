# vakto

> Esperanto for _the watch_ — sentry duty.

A board-driven supervisor for coding agents: it watches a work board, claims
items, dispatches an agent lane, and reports back — so a human manages work
instead of supervising sessions.

**Status: design stage.** The supervisor contract is settled in
[ADR 0001](docs/adr/0001-supervisor-contract.md) and the build plan is sliced in
[docs/plan/0001-map.md](docs/plan/0001-map.md). There is no runnable supervisor
yet; `src/contract.ts` holds only the pure, tested pieces of the contract.

## Why

Interactive agent sessions stop scaling at a handful of parallel threads.
Attention, not compute, is the bottleneck: every thread needs a human to read
it, steer it, and dispose of it. The unit that scales instead is an _issue with
an owner and a proof_ — an item on a board that something picks up, works, and
returns with evidence.

vakto is the missing middle: the thing that watches the board, decides what is
ready, hands it to an agent lane, and reports honestly about what came back.

## Core ideas

1. **The board owns work state.** What exists and where it sits in the
   lifecycle lives on a work board (GitHub Issues and Projects by default).
   vakto keeps only a small ledger: leases, dispatch attempts, wake records.
2. **Reconcile, never apply.** Every wake re-derives the world from the board
   rather than executing the event that woke it. Duplicate, replayed, or
   dropped events therefore cannot corrupt state.
3. **Claims are leases.** A board has no atomic claim, so vakto writes a lease
   with an expiry into its ledger before it touches anything.
4. **Explicit authority.** vakto may label, move, comment, claim, dispatch, and
   open pull requests and drive them to green. It may not merge, and it may not
   change the board's schema.
5. **One plug to pull.** Every deployment documents and tests how to stop it.

## Shape

```
 work board            wake                 supervisor            lanes
 ┌──────────┐   ┌──────────────┐   ┌────────────────────┐   ┌──────────────┐
 │  Issues  │──▶│  HTTP hook   │──▶│  vakto             │──▶│  agent run   │
 │  + cards │   │  (durable)   │   │  reconcile         │   │  in isolated │
 │          │◀──│              │◀──│  claim (lease)     │◀──│  workspace   │
 └──────────┘   └──────────────┘   │  dispatch          │   └──────┬───────┘
      ▲                            │  report            │          │
      │        evidence + status   └────────────────────┘          ▼
      └──────────────────────────────────────────────────────  pull request
                                                                 (full green)
```

The wake transport is deliberately outside vakto's scope: any durable HTTP
relay that can start an agent turn fits. A transport that retries is expected,
which is exactly why the supervisor reconciles instead of applying.

## Contract

The pieces that must not be improvised live in `src/contract.ts`:

- **Work identity** — `deriveIdempotencyKey` keys on the work item, never on a
  delivery id. A relay that mints a fresh id per delivery, or a GitHub
  redelivery, must both collapse to one claim.
- **Leases** — `isLeaseValid` / `planReconcile` decide claim, skip, or no-op
  from board state plus ledger state, and never from the event alone.

`config.example.json` shows the deployment-specific values (board, label,
project field ids, transport endpoint, authority allowlist). Those are
configuration, not code, and never live in this repository.

## Documentation

- [Supervisor contract](docs/adr/0001-supervisor-contract.md) — the decision
  record: state ownership, triggers, authority, failure modes.
- [Build plan](docs/plan/0001-map.md) — the map and its slices.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through
[GitHub private vulnerability reporting](SECURITY.md), never a public issue.

## Development

Requires Node `>=24.11.0`. The toolchain is
[Vite+](docs/adr/0002-toolchain-vite-plus.md), pinned as a project dependency, so
there is no global install to perform.

```sh
npm install
npm run check   # format, lint, type checks
npm run test    # Vitest
npm run pack    # library build into dist/
npm run ci      # all three
```

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).
