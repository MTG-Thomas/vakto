# Rules internalized from adjacent packages

Status: accepted · Date: 2026-10-12 · Refines: [ADR 0001](0001-supervisor-contract.md), [ADR 0003](0003-coordination-lessons.md) · Source: [adjacent art](../notes/adjacent-art.md)

## Context

Four packages in the same ecosystem solve parts of this problem, and reading
their published sources produced six rules that are not yet in this contract.
[The note](../notes/adjacent-art.md) records where each came from; a note is not
a decision, so this record makes them binding, and the plan binds each one to a
slice where it can be proven.

Each rule below is stated as what it requires, why the predecessor paid for it,
what it forbids, and how a test proves it. Numbers that look like policy — wake
intervals, budgets — are configuration with a default, not contract.

## Decisions

### 1. The wake carries no work content

A wake states only that there is work and how to read it; the work itself comes
from an authenticated read by the supervisor. **Why:** an injected message is
read by the model as an instruction, and board content is written by other
agents and by people we do not control. A wake that quoted an issue title would
place someone else's text in front of the model as a command at the exact moment
it is most likely to be obeyed. **Forbids:** interpolating any payload field —
title, body, comment, label, actor — into the wake prompt. **Verified by:** a
test that injects a payload whose every text field contains an instruction and
asserts the wake prompt is byte-identical to the fixed template.

### 2. Wakes are suppressed and budgeted

No wake for work that is parked or deferred, for a reconnect that carried
nothing new, for an empty queue, or for an item already announced and still
unacknowledged. At most one wake per interval, first item after a quiet period
immediate, later items batched. A busy lane is left alone and re-checked when it
settles rather than having wakes stacked behind it. **Why:** the predecessor
measured nagging — one deferred item cost 288 turns a day — and every rule here
came from an observed wake that helped nobody. **Forbids:** waking on the mere
fact of an event; re-announcing work already announced. **Verified by:**
table-driven tests over (board state, lease state, wake history) asserting wake
or no-wake, plus a test that a busy lane defers and is re-checked rather than
queued.

### 3. Reconcile only for what the last look did not see

Delivery is not trusted, so a periodic reconcile is mandatory. It wakes only
when it finds work where the previous look found none, and the mechanism
documents the gaps it cannot close. **Why:** realtime drops events; a reconcile
that re-announced everything would reinstate the nagging that rule 2 exists to
prevent. **Forbids:** treating a reconcile pass as permission to re-announce
known work; leaving the residual gaps unstated. **Verified by:** a test that a
dropped delivery produces exactly one reconcile wake, and that a second
reconcile against an unchanged board produces none.

### 4. A board write never fails silently, and budgets charge live work

Every write either lands or reports. Anything hidden, truncated, or unparsed is
disclosed together with the identifiers needed to re-read it — board revision
and location. Capacity limits count _live_ work; completed rows are evidence and
never consume the budget that gates new work. **Why:** the predecessor's board
deadlocked itself with its own audit trail, because a cap counted every row
while the ownership guard forbade dropping a peer's finished row. Our writes are
field-scoped rather than full-replacement, so we adopt the principle, not their
apparatus. **Forbids:** a silently truncated read or write; a cap that counts
evidence. **Verified by:** a test that a truncated result carries the disclosure
fields, and a test that a board at its cap still accepts new work when the cap is
exceeded only by completed rows.

### 5. Stop is two verbs, and resuming reports what was measured

**Disable** prevents new work and leaves in-flight runs alone; **stop** cancels
the in-flight run and lands at a safe checkpoint, leaving the item resumable
with no partial evidence claimed. A terminal close releases the lease and
preserves evidence; a stop does not. When a run resumes or fails, the report
states what was measured — how long since the last write, what was not rolled
back — and **attributes no cause**, because a stopped host, a hung lane, and a
slow run are indistinguishable from the supervisor's position. **Why:** "one
plug to pull" is two different guarantees, and cause-free reporting is the
difference between an honest status and a guess presented as a diagnosis.
**Forbids:** conflating disable with stop; claiming evidence for an interrupted
run; asserting why a run stopped. **Verified by:** a test that cancel mid-lane
leaves the item resumable with no claimed evidence, a test that disable does not
touch in-flight runs, and a test asserting the resume report contains no causal
claim.

### 6. Authority is scoped by the channel a write arrives on

A wake that arrives through the transport may start, stop, and inspect existing
work; it may never author or redefine it — no new definitions, no board schema
change, no widening of its own authority. Provenance is decided by the channel
and credential that delivered the write, never by fields the caller supplies.
Credentials are resolved locally and never appear in payloads, comments, or
logs. The board records work state only: no endpoints, ports, handles, or other
reachability records. **Why:** the transport is the least trusted channel in the
system, and the predecessor's rule is that a remote client may operate what
exists but may not create. Reachability on the board would put a directory of
live targets in the same place as work anyone can read. **Forbids:** a
transport-triggered write that defines or redefines work; trusting caller-asserted
provenance; putting transport or credential detail on the board or in the repo.
**Verified by:** a test that a wake delivered through the transport cannot cause
a definition or schema write, a test that caller-supplied provenance fields are
ignored in favour of the channel's, and a scan asserting no endpoint or
credential material is written to the board.

## Consequences

- **Slice acceptance criteria get sharper.** Rules 1–3 bind the wake-path slice,
  rule 4 the reconcile slice, rules 5–6 the takeover slice. A slice whose tests
  do not cover its rules is not done.
- **Intervals and budgets are configuration.** The one-wake-per-interval default,
  the reconcile period, and the live-work cap are deployment values with
  documented defaults. Changing a default is configuration; changing what is
  suppressed is a contract change.
- **Two rules are cheaper than they look.** Rules 1 and 6 are mostly restraint:
  the wake template stays constant, and the transport stays unable to author.
  Both are easier to hold now than to retrofit once a payload is trusted.
- **One rule is a promise about honesty, not mechanism.** Rule 5's cause-free
  reporting is a discipline the supervisor can break without failing any test
  except the one written for it, which is the point of writing that test.

## What this does not change

None of the four packages becomes a dependency, and none of their architectures
becomes ours: three coordinate sessions that already exist, and the fourth is a
window onto work rather than a supervisor of it. What transfers is the small
number of rules above, each of which the predecessor learned the expensive way.

## References

- [Adjacent art](../notes/adjacent-art.md) — the survey these rules came from.
- [ADR 0001](0001-supervisor-contract.md) — the contract they refine.
- [ADR 0003](0003-coordination-lessons.md) — dispatch lifecycle, leases, isolation.
