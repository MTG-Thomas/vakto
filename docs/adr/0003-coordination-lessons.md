# Coordination lessons and external constraints

Status: accepted · Date: 2026-10-12 · Refines: [ADR 0001](0001-supervisor-contract.md)

## Context

Two bodies of prior art shape this project's coordination contract. The first is
in-house: `codex-swarm`, the predecessor of this project and the ancestor of the
transport that wakes it. The second is external: the durable-execution,
queueing, and controller literature that has already solved most of these
problems, usually with a name for each.

This record adopts what transfers from both, and names what deliberately does
not. Everything below is either an invariant taken from a predecessor or a
constraint verified at its primary source; where a claim rests on secondary
material, it says so.

`codex-swarm` is the predecessor of this project: a local-first Go CLI and
daemon that kept worker identity, ownership claims, messages, handoffs and
validation evidence in a machine-local SQLite ledger, plus an optional
Worker/D1 relay for cross-host delivery. That relay is the direct ancestor of
the transport this supervisor is woken through, and the swarm's operating
invariants were written after living with parallel agents for months.

Its centre of gravity is different from ours: it coordinates workers an
operator starts, while this project watches a board and starts work itself. But
almost everything it learned about _dispatch_, _claims_, and _uncertainty_
applies directly, and its invariants are cheap to inherit now and expensive to
retrofit. This record adopts what transfers, and names what deliberately does
not.

## Decisions adopted

1. **Two authorities, and neither replicates the other.** The board owns the
   work item's lifecycle. The local ledger owns the _dispatch_ lifecycle:
   attempts, receipts, leases, wake records. Target systems — Git, the forge,
   any platform being operated — keep authority over their own conflicts. The
   swarm's phrasing is the rule: record identity, warnings, links, and returned
   evidence, and never silently override a target system's decision.
2. **A lease is not a lock.** The swarm treats claims as warning-only
   coordination, not a second permission system. Ours gates _dispatch_ — one
   run per item — and nothing else. An expired lease is re-claimable, a human
   working the item by hand always wins, and the supervisor never fights a
   direct edit. This refines ADR 0001's claim section, which read as though a
   live lease made an item untouchable.
3. **Dispatch has an explicit lifecycle, including `uncertain`.** The swarm's
   relay states are `queued → dispatching → submitted → uncertain →
   acknowledged → completed`. `uncertain` means the submission may have
   happened; the rule is to inspect before resending, then reuse the _same_
   request id and exact content, and never to retry blindly. It also refuses to
   resubmit work already acknowledged, and deliberately treats a crash between
   submission and recording as uncertain. We adopt the states, the request-id
   idempotency, the separate receipt that carries evidence, and the
   no-blind-retry rule.
4. **One terminal transaction.** The swarm's `close` marks the work done or
   failed, releases every claim, refreshes linked pull requests, and preserves
   the completion evidence atomically; a lower-level `report` exists for cases
   where claims must stay active, and janitor commands only _identify_ stale
   work — applying cleanup is always explicit. We adopt that shape: one atomic
   close, a separate in-progress update that keeps the lease, and no automatic
   cleanup.
5. **Lanes are described by capability, not by product.** The swarm keeps engine
   identity for diagnostics but decides through stable capabilities such as
   `resume`, `managed_worktree`, `live_message`, `automatic_completion`, and
   `external_tracker`. Our supervisor asks what a lane can do — resumable,
   isolated workspace, live steering, reports completion — never which agent
   product it is. This is what keeps a FOSS supervisor generic.
6. **Isolation is filesystem, not conversation.** A separate session is not
   isolation: two writers sharing a checkout still collide. One branch and one
   worktree per item, a branch lock held only while the checkout is created or
   reused, and **dirty worktrees preserved and reported rather than reset**.
7. **Mutations are narrow and verifiable.** New mutation paths take narrow
   inputs, an explicit request id, idempotent replay, and durable readback.
   Loopback or not, a mutation surface is treated as privileged.
8. **The transport is a mailbox, not a ledger.** The relay owns its explicitly
   shared messages with recovery state on both ends; there is no multi-master
   replication and no elevated remote execution endpoint. Its own documentation
   says not to treat it as a transparent replacement of the local ledger, and
   its quota mechanism can only _lower_ checked-in ceilings, with quota
   failures answered as retryable and existing idempotency keys still
   replayable.
9. **Tests use fakes.** Their relay integration runs against a fake worker and
   never a live task. Ours will run against a fake board and a fake lane; a test
   that needs a real repository, forge credential, or live agent is not a test.
10. **Documentation states what is true.** The swarm's rule against
    chronological MVP language, exhaustive command dumps, and examples implying
    unimplemented behaviour applies here with more force, because this
    repository is public and its contract is the product.

## Deliberately not adopted

- **Local-first, operator-initiated coordination.** The board is the trigger and
  the human's control plane; the swarm's model assumes an operator already
  started the work.
- **A daemon with a mutation HTTP surface.** Nothing here needs a privileged
  listener yet, and the swarm's own rule is to keep such surfaces read-only
  until authentication, idempotent replay, and operator controls exist.
- **Distribution machinery.** Installers, packaging, service registration, and
  release signing earn their place when something is worth installing.
- **Issue markers as a rendezvous.** Pulling a marker into local state is safe;
  treating a comment as a lease is not.

## Adoption triggers

Each of these is the trigger to add the thing, and the reason to not add it yet.

| Add                                       | When                                                                                              | Why not yet                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A queue between board and lane            | A board event must fan out to several lanes, or deliveries outlive the ledger's lease horizon     | Reconcile-from-board already absorbs duplicate and dropped wakes |
| Concurrent lanes (>1)                     | One lane is boring, green, and the ledger shows no double-claims across a week                    | Concurrency is where duplicate-claim bugs hide                   |
| A durable agent runtime (e.g. pi-durable) | A killed run must resume without repeating tool effects — proven by the slice 3 test, not assumed | The failure it fixes has not been demonstrated here              |
| A service/daemon wrapper                  | A lane must run unattended across reboots, with a supervisor of its own                           | The trigger for now is a laptop being awake, deliberately        |
| Retention policy on the ledger            | Ledgers grow past what an operator will read, or replay beyond the lease horizon is needed        | Small, inspectable ledgers are a feature at this size            |
| Postgres or a hosted store                | More than one host must share dispatch state                                                      | The ledger is deliberately single-writer, like the swarm's       |

## Constraints verified at the source

These are not preferences. Each one removes an option, and each is why a rule
above reads the way it does.

| Source                                     | Verified                                                                                                                                                                                                                                                                                                              | Effect on this contract                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub webhook delivery                    | Manual and API redelivery covers roughly the last three days; failed deliveries are not retried by default (automatic redelivery is an opt-in repository feature). Recommended practice is to dedupe on `(hook ID, X-GitHub-Delivery)`, verify the signature first, and make the domain operation idempotent as well. | Idempotency retention must outlive the _upstream_ replay window, not just the transport's 24-hour TTL. A redelivery can legitimately arrive after the relay has dropped the delivery, so a ledger that forgets a claim sooner than the forge can replay duplicates work. Signature verification precedes every other effect, including reading the body. |
| Kubernetes controllers                     | Reconciliation is level-triggered; `observedGeneration` records which spec generation the status reflects; adding a finalizer does not mean the generation was reconciled; finalizers are added before external work and removed only after cleanup succeeds.                                                         | A dispatch records which board revision it acted on, so a stale decision is detectable. The in-flight marker goes on before the lane starts and comes off only after evidence is written — an ordering rule, not two independent writes.                                                                                                                 |
| Temporal                                   | Activities are at-least-once, so external effects need stable idempotency keys. `SignalWithStart` atomically starts or signals a workflow but does **not** deduplicate independent business operations; signals need application-level operation ids.                                                                 | Transport-level deduplication is provably insufficient on its own. Our wake is a signal, so the operation id — and therefore the dedupe decision — belongs to the supervisor, which is what reconcile-from-board provides.                                                                                                                               |
| Kleppmann, _How to do distributed locking_ | A lease cannot prevent a stale writer; correctness requires a monotonically increasing fencing token enforced by the protected resource. This is an argument from analysis rather than a standards consensus.                                                                                                         | The forge enforces no such token, so board writes cannot be fenced. Advisory claims are the only correct choice available here, and takeover must stay possible rather than being "fixed" with a stronger lock.                                                                                                                                          |

Two consequences, stated plainly because both were wrong before this
verification:

1. **The 24-hour horizon was a mistake.** It matched the transport and looked
   tidy. The correct rule is that the ledger remembers a claim at least as long
   as any source can replay the event that produced it — the longer of the
   transport's retention and the forge's redelivery window.
2. **No fencing means no pretending.** Every rule that keeps the lease advisory
   is load-bearing. A future proposal to make claims authoritative on the board
   has to answer Kleppmann's argument first.

## References

- `codex-swarm`: `AGENTS.md` (architecture invariants), `docs/design.md`
  (authority boundaries, lifecycle and closeout, relay section),
  `docs/cross-host-relay.md` (state table, recovery contract, quotas),
  `docs/mature-go-cli-lessons.md` (borrow-now/later/avoid discipline),
  `coordinator/migrations/0001_relay.sql` and `0002_relay_quotas.sql`.
- [ADR 0001](0001-supervisor-contract.md) — the contract this record refines.
- GitHub: <https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks>
- Kubernetes finalizers:
  <https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/>
- Kleppmann, _How to do distributed locking_:
  <https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html>
- Temporal, signal-with-start:
  <https://github.com/temporalio/documentation/blob/main/docs/design-patterns/signal-with-start.mdx>
