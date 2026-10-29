/**
 * The parts of the supervisor contract that must be provable without a board,
 * a network, or a host.
 *
 * Contract: docs/adr/0001-supervisor-contract.md
 *
 * Nothing here performs I/O. Board reads, ledger writes, and dispatch live
 * behind these decisions; this module only decides *what should be true*.
 */

/** A work-lifecycle event, as delivered by the transport. */
export interface WakeEvent {
  /**
   * Transport-supplied delivery identity. Recorded for audit only — never used
   * as an idempotency key, because a retrying transport mints a new one per
   * delivery.
   */
  readonly deliveryId: string;
  /** Event family, e.g. `issues`. */
  readonly event: string;
  /** Event action, e.g. `labeled`. */
  readonly action: string;
  /** Work item repository, `owner/name`. */
  readonly repo: string;
  /** Work item number. */
  readonly issueNumber: number;
  /** Label named by the event, when the event carries one. */
  readonly label?: string;
  /** ISO timestamp the transport received the delivery. */
  readonly receivedAt: string;
}

/** The work item as the board currently describes it. */
export interface BoardItem {
  readonly repo: string;
  readonly issueNumber: number;
  /** Labels currently on the item. */
  readonly labels: readonly string[];
  /** Board status name, absent while the item is not yet on the board. */
  readonly status?: string;
}

/** A supervisor's claim on a work item, with an expiry. */
export interface Lease {
  /** Work identity this lease covers. */
  readonly key: string;
  /** Who holds it. */
  readonly holder: string;
  /** ISO timestamp at which the lease stops being valid. */
  readonly expiresAt: string;
}

export type ReconcileAction =
  | { readonly kind: "claim"; readonly key: string; readonly reason: string }
  | { readonly kind: "skip"; readonly reason: string }
  | { readonly kind: "noop"; readonly reason: string };

export interface ReconcileInput {
  readonly wake: WakeEvent;
  /** Absent when the board does not know this item yet. */
  readonly board: BoardItem | undefined;
  /** Absent when nothing holds a claim. */
  readonly lease: Lease | undefined;
  /** The label that marks an item as ready to be worked. */
  readonly readyLabel: string;
  /** This supervisor's identity, for holder comparison. */
  readonly holder: string;
  readonly now: Date;
}

const LABEL_EVENT = "issues";
const LABEL_ACTION = "labeled";

/**
 * Work identity. Deliberately independent of the delivery: two deliveries of the
 * same work item, and a GitHub redelivery, must all collapse to one key.
 */
export function deriveIdempotencyKey(work: Pick<BoardItem, "repo" | "issueNumber">): string {
  return `${work.repo}#${work.issueNumber}`;
}

/** Evaluate expiry, rejecting an invalid current date rather than permitting a new claim. */
export function isLeaseValid(lease: Lease | undefined, now: Date): boolean {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs))
    throw new RangeError("Lease evaluation requires a valid current date");
  if (lease === undefined) return false;
  const expiresAt = Date.parse(lease.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  // Date.parse normalizes impossible calendar dates, such as February 30.
  const date = /^([+-]\d{6}|\d{4})-\d{2}-\d{2}(?=T)/.exec(lease.expiresAt)?.[0];
  if (date === undefined) return false;
  const midnight = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || !new Date(midnight).toISOString().startsWith(`${date}T`)) {
    return false;
  }
  return expiresAt > nowMs;
}

/**
 * Decide what this wake should do. Every replay of an already-claimed item must
 * land on `skip` or `noop` rather than a second claim.
 */
export function planReconcile(input: ReconcileInput): ReconcileAction {
  const { wake, board, lease, readyLabel, holder, now } = input;

  if (wake.event !== LABEL_EVENT || wake.action !== LABEL_ACTION) {
    return { kind: "noop", reason: `not a work-lifecycle event (${wake.event}.${wake.action})` };
  }

  if (wake.label !== readyLabel) {
    return { kind: "noop", reason: `label ${wake.label ?? "(none)"} is not the ready label` };
  }

  const key = deriveIdempotencyKey(wake);

  if (board !== undefined && !board.labels.includes(readyLabel)) {
    return { kind: "noop", reason: "ready label is no longer on the item" };
  }

  if (isLeaseValid(lease, now)) {
    if (lease !== undefined && lease.holder === holder) {
      // This is the replay path: the item is already ours.
      return { kind: "noop", reason: `already claimed by ${holder} until ${lease.expiresAt}` };
    }
    return { kind: "skip", reason: `leased by ${lease?.holder} until ${lease?.expiresAt}` };
  }

  const expired = lease === undefined ? "" : ` (previous lease by ${lease.holder} expired)`;
  return {
    kind: "claim",
    key,
    reason:
      board === undefined
        ? `not on the board yet; add and claim${expired}`
        : `ready and unclaimed${expired}`,
  };
}
