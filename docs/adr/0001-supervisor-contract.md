# Agent supervisor contract

Status: accepted · Date: 2026-10-12 · Refined by: [ADR 0003](0003-coordination-lessons-from-codex-swarm.md)

> ADR 0003 adopts coordination lessons from `codex-swarm` and sharpens two
> points below: a lease gates dispatch rather than locking an item, and the board
> and the ledger hold separate authorities without replicating each other.

## Context

Coding agents are easy to run and hard to run _in parallel_. Every interactive
session needs a human to read it, steer it, and decide what to do with the
result, so throughput is bounded by attention rather than compute. The
alternative is to let a finite pool of autonomous runs consume a queue of
well-formed work items and return evidence — but then something has to own the
queue, and that something needs to survive the failure modes a real queue
brings: duplicate events, expired runs, leaked claims, and a host that
disappears mid-flight.

This repository holds that supervisor — the component that watches a work board
and turns ready items into evidence-backed results. This record fixes the
contract before any of it is built.

## Decision

1. **The board owns work state.** What exists, and where it sits in the
   lifecycle, is board state (GitHub Issues plus a Projects board by default).
   The supervisor keeps only a ledger of leases, dispatch attempts, and wake
   records. There is no second tracker and no mirrored state.
2. **The trigger is a work-lifecycle event, not a status field change.** A label
   applied to an issue wakes the supervisor. Board status is _displayed_ state
   that the supervisor maintains, so the board never becomes the event bus.
3. **Ingress is a durable HTTP hook.** Some relay receives the event and starts
   an agent turn. The supervisor assumes at-least-once delivery, retries, and a
   finite retention window on the relay. Transport specifics are configuration.
4. **Every turn reconciles from the board.** A wake never _applies_ an event. It
   re-reads the board and the ledger and computes what should be true now.
   Replay, duplication, and dropped deliveries collapse to no-ops, which is what
   makes an unreliable transport safe enough to depend on.
5. **Claims are leases.** Because a board offers no compare-and-swap, the
   supervisor writes a lease with an expiry into its ledger before mutating
   anything. A lease that expires is re-claimable; a lease that is live means
   the item is someone else's problem.
6. **Idempotency keys describe work, not deliveries.** A key is derived from the
   work item and the transition being performed. Delivery identifiers are
   recorded for audit but never used for identity.
7. **Authority is explicit and bounded.** The supervisor may label, move,
   comment, claim, dispatch lanes, and open pull requests and drive them to
   green. It may not merge. It may not change the board schema. It acts only
   inside a configured repository allowlist.
8. **One plug to pull.** A deployment must document and test how to stop it —
   disable the trigger, revoke the transport credential, or stop the host —
   and the board must remain correct and readable after all three.

## Consequences

- **Availability equals host availability.** If the supervisor's host is down,
  wakes queue or are dropped by the transport's retention window. Nothing is
  lost from the board's point of view; the next wake reconciles. This is
  accepted: a single physical point of control is a feature for a human who
  wants one plug to pull.
- **Board writes must be idempotent.** Point 4 only holds if adding an item,
  moving a card, and commenting can all be repeated without side effects. Any
  new board mutation needs its own repeatable form.
- **The ledger is load-bearing.** It is small, but losing it produces duplicate
  claims. It needs the same backup and restore attention as the board.
- **Latency is bounded by the transport.** An 8-second forward timeout and a
  fire-and-forget acknowledgement mean the supervisor must start no work inside
  the request. Every wake is accepted, then reconciled.
- **Agent runs are the expensive part, so they must be earned.** A run starts
  only for a claimed, ready item; nothing speculative.

## Alternatives considered

- **A second work tracker.** Rejected: it duplicates the source of truth and
  adds a surface a human has to keep in sync.
- **An intermediate workflow engine in the wake path.** Deferred, not rejected.
  It earns its place when several unrelated event sources must share one ingress
  and one run record. For a single board trigger it is extra moving parts, and
  the durable relay already provides retry, backoff, and retention.
- **Status field change as the trigger.** Rejected: it makes the board the event
  bus and ties the trigger to project-level event support that is not uniformly
  available.
- **Applying events directly.** Rejected: it makes correctness depend on
  exactly-once delivery, which no part of this system provides.
- **Draft pull requests only.** Rejected: a human reviews at the pull request
  gate, so the lane's job is to reach full green, not to stop at an
  unreviewable draft.

## References

- [Build plan](0001-map.md) — this contract as slices.
