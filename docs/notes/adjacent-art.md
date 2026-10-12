# Adjacent art

Status: living note · Reviewed: 2026-10-12 · Contract: [ADR 0001](../adr/0001-supervisor-contract.md), [ADR 0003](../adr/0003-coordination-lessons.md)

## What this note is

A survey of the packages closest to this problem, so the project borrows instead
of rediscovering, and so its novelty claim stays honest. A note is not a
decision: if one of these changes a rule, that belongs in a decision record.

Evidence level: each entry was read from the **published package source** at the
version named (tarball inspection) plus its README, on 2026-10-12. None was
installed or run. The pi package gallery lists 166 packages matching
"orchestration" and 139 matching "board"; this note covers the four that overlap
this project's _contract_ rather than its vocabulary.

| Package                       | Licence       | Shape                                 | Borrowed from it                                         |
| ----------------------------- | ------------- | ------------------------------------- | -------------------------------------------------------- |
| `@consiliency/agent-board-pi` | Apache-2.0    | Wake lane over an inbox subscription  | The content-free wake, and measured wake suppression     |
| `tower-do`                    | MPL-2.0       | Shared task board in a JSONL file     | Ownership guard, receipts, and the disclosure discipline |
| `@mjasnikovs/pi-task`         | AGPL-3.0-only | Persisted phase pipeline, crash-safe  | Safe checkpoints, and honest resume reporting            |
| `@yunazgr/pi-companion`       | MIT           | Rust daemon, pairing, embedded web UI | Daemon posture and channel-scoped authority              |

Licence note: patterns and designs are not copyrightable, and nothing below is
copied code. If code is ever reused, MIT and Apache-2.0 are compatible with this
project's AGPL-3.0-or-later; MPL-2.0 is file-scoped copyleft; `pi-task` is
AGPL-3.0-**only**, which cannot be folded into an or-later grant, so it stays
design inspiration.

## 1. `@consiliency/agent-board-pi` — the wake lane

**What it is.** A wake-only extension for a "Message Board". It holds a
websocket to the host's own inbox, and when that inbox changes it asks the board
whether anything is `new` or `restored`. Only then does it inject one fixed
sentence into the session, telling the agent to read its inbox through the
canonical path. It ships no board tools at all.

**Worth borrowing.**

- **The nudge carries no content, deliberately.** Their reasoning is the part
  worth stealing: an injected message is read by the model as instruction, and
  board content is written by other agents and by people you do not control. A
  wake that quoted a subject line would put someone else's text in front of the
  agent as an instruction at the exact moment it wakes. So the wake says _that_
  there is work; what it is comes from an authenticated read. This is a security
  property, not tidiness, and it should bind our wake prompt too.
- **Wake suppression rules learned by measurement.** They do not wake for items
  the agent deferred, its own acknowledgements, reconnects, an empty inbox, or an
  item it was already woken for and has not yet acknowledged — and they cite the
  cost: "one deferred item cost 288 turns a day". Board state is consulted
  _before_ every wake.
- **A wake budget.** At most one wake per five minutes; the first item after a
  quiet spell is immediate and later ones batch, because the nudge does not say
  how many items there are.
- **Realtime is not trusted.** A five-minute reconcile catches dropped events,
  and it wakes only when it finds work where the last look found none, so it
  cannot nag. They then enumerate the two gaps that remain. Stating residual
  gaps in the mechanism's own documentation is a habit worth copying.
- **Busy means wait, not queue.** A working session is left alone and checked
  again when it settles.
- **Waking is not tools.** An MCP adapter connects lazily and disconnects when
  idle — correct for tools, exactly wrong for waking, because waking needs a live
  subscription precisely while the agent is idle. Our transport has to be the
  held-subscription shape, never a lazy tool call.
- **No reachability record.** Nothing on the board says where a session can be
  reached: no handle, no port, no registry. Identity comes from a local identity
  file, and a partial identity beside the file is refused rather than merged.

**Not our problem.** It has no board of its own, no claims, no dispatch, no
lane, and no evidence beyond the wake. It wakes exactly one inbox.

## 2. `tower-do` — the shared board

**What it is.** A shared multi-agent task board with no daemon and no database:
state is a JSONL file per project (`~/.pi/tower-do/<project>/board.jsonl`) that
every session and subagent reads and writes. Tools for plan / claim / complete /
block, cross-agent messaging, structured findings, presence, and an
above-editor widget.

**Worth borrowing.**

- **Ownership guard.** Only the row's owner, or the board's own `tower`
  identity, may change that row's fields.
- **Receipts.** Completing a task records the `changedFiles` actually touched,
  so the next owner knows what just moved under them.
- **Advisory conflict detection, never a gate.** Overlapping declared scopes are
  flagged and resolved by talking. This is independent confirmation of ADR
  0003's "a lease is not a lock".
- **Budget the live work, not the history.** A cap that counted every row
  write-blocked a finished board, because the ownership guard forbids dropping a
  peer's completed row — the board deadlocked itself with its own audit trail.
  The fix charges the budget to non-completed rows and bounds only how much
  _fabricated history_ one write may introduce. Any future cap here should ask
  the same question: is this counting work, or counting evidence?
- **Disclosure discipline.** Because a write replaces the board wholesale, the
  dashboard may never silently hide a row a caller is obliged to replay. It
  discloses hidden-row counts, byte and line truncation (keeping the tail, and
  repeating the revision and board path in a reserved footer), and lines the
  fold could not parse. Nothing in a full-replacement write model may fail
  silently.
- **Presence that matters.** Active, idle, or gone-quiet _while still owning
  unfinished work_ — the distinction a coordinator actually needs before
  reassigning.
- **Documentation split.** `ARCHITECTURE` (data flow), `CONTRACTS` (semantic
  invariants, each naming the test that proves it), `DECISIONS` (why), and
  `OPERATIONS`. Worth adopting in this repository once there is enough surface
  to justify it.

**Not our problem.** The board _is_ the state — there is no external work
source, no lease with an expiry (a gone-quiet owner is visible, not
reclaimable), no cross-host path, and no lane or pull request to drive.

## 3. `@mjasnikovs/pi-task` — crash-safe checkpoints

**What it is.** A persisted pipeline that turns a request into a spec — refine,
research, grill, compose, critique — with every phase boundary written to a
hand-editable Markdown file, plus a loop over many tasks and a remote view.

**Worth borrowing.**

- **State you can read, diff, and edit by hand**, one file per task, written at
  every phase boundary. Crash safety falls out of the fact that progress is
  legible rather than opaque.
- **Cancel at a safe checkpoint**, not at an arbitrary instant: mid-phase it
  kills the running child; during implementation it lets the turn finish and
  stops before the gates. "Still resumable" is a property of where you stop.
- **Unattended resume re-enters in-flight runs only.** A failed or cancelled run
  "stopped for a reason a power cycle does not clear", so it is reported and left
  alone rather than driven at the same wall again. That is our no-blind-retry
  rule, arrived at independently and stated better.
- **Honest resume reporting.** The banner says what it measured — how long since
  the last write, and that nothing was rolled back — and **attributes no
  cause**, because a stopped host, a hung child, and a slow task are
  indistinguishable from there. Our standup and needs-you output should hold the
  same line.
- **Deterministic by construction:** phase order is fixed code over a config
  table, not a model's choice, and there is a loop detector for small models.
- **First-answer-wins across surfaces:** the same question appears in the local
  TUI and every connected browser, and whoever answers first dismisses the rest —
  with the local path unchanged when nobody is connected.

**Not our problem.** It plans what it is asked, from no work source, with no
claims, no dispatch to a lane, and no pull request gate. It hands a spec to the
session.

## 4. `@yunazgr/pi-companion` — the daemon posture

**What it is.** Remote control and observability for Pi sessions. Its own
framing is the useful part: "deliberately not another agent runtime. Pi owns
execution and conversation state. A single Rust daemon owns session discovery,
pairing, temporary file exchange, browser fan-out, and the embedded web UI."

**Worth borrowing.**

- **The split itself.** A daemon that owns transport, pairing and presentation,
  and nothing about execution. Our supervisor should be equally narrow: it owns
  dispatch bookkeeping and never the conversation.
- **Zero-config daemon lifecycle:** probe the admin port, coordinate concurrent
  starts through a lock file, and let the daemon also refuse a second bind —
  defence in depth, with a stale-lock timeout and backoff on download failure.
- **Authority scoped by channel.** Mobile and remote clients may inspect, start,
  and stop existing automation definitions but **cannot author them**; an
  upload's provenance is decided by which endpoint it arrived through, not by
  what it claims. Both are directly applicable to our authority envelope, where
  the question is always "which channel is this write arriving on?".
- **Credentials never leave the host:** subscription usage is resolved host-side
  through the host's own OAuth path, cached briefly, and never sent to a browser
  or stored by the daemon; provider failures are surfaced as remediation
  guidance rather than raw payloads.
- **Disable is not stop.** Disabling prevents future scheduled runs; stopping
  cancels the one in flight. Our "one plug to pull" has the same two halves and
  should name them the same way.
- **Automation definitions with run history**, phases rendered as flowcharts
  including failure and retry paths.

**Not our problem.** No multi-host dispatch, no claims, no work selection, no
pull request. It is the window onto work, not the supervisor of it.

## The gap all four leave

Each covers one part well and stops: a wake channel with a real contract
(agent-board), a shared board with ownership and receipts (tower-do), persisted
pipelines with safe checkpoints (pi-task), and a narrow daemon with pairing and
credential discipline (companion). None takes an **external work source** as the
source of truth and then claims, dispatches, evidences, and hands back to a
human — and none spans hosts.

That is the claim this project should keep making, in exactly those words, and
the four borrowings above are the parts it should not invent: a content-free
wake, disclosed board writes, safe checkpoints with cause-free reporting, and a
daemon that owns transport rather than execution.
