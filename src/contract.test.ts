import { describe, expect, it } from "vite-plus/test";

import {
  deriveIdempotencyKey,
  isLeaseValid,
  planReconcile,
  type BoardItem,
  type Lease,
  type WakeEvent,
} from "./contract.ts";

const READY = "agent:ready";
const HOLDER = "vakto@host-a";
const NOW = new Date("2026-10-12T12:00:00.000Z");

const wake = (overrides: Partial<WakeEvent> = {}): WakeEvent => ({
  deliveryId: "6f1e4c2a-0000-4000-8000-000000000001",
  event: "issues",
  action: "labeled",
  repo: "acme/widget",
  issueNumber: 42,
  label: READY,
  receivedAt: NOW.toISOString(),
  ...overrides,
});

const item = (overrides: Partial<BoardItem> = {}): BoardItem => ({
  repo: "acme/widget",
  issueNumber: 42,
  labels: [READY],
  status: "Ready",
  ...overrides,
});

const lease = (overrides: Partial<Lease> = {}): Lease => ({
  key: deriveIdempotencyKey({ repo: "acme/widget", issueNumber: 42 }),
  holder: HOLDER,
  expiresAt: "2026-10-12T14:00:00.000Z",
  ...overrides,
});

const plan = (input: Partial<Parameters<typeof planReconcile>[0]> = {}) =>
  planReconcile({
    wake: wake(),
    board: item(),
    lease: undefined,
    readyLabel: READY,
    holder: HOLDER,
    now: NOW,
    ...input,
  });

describe("deriveIdempotencyKey", () => {
  it("ignores delivery identity", () => {
    const first = deriveIdempotencyKey(wake({ deliveryId: "a" }));
    const second = deriveIdempotencyKey(wake({ deliveryId: "b" }));
    expect(first).toBe(second);
    expect(first).toBe("acme/widget#42");
  });
});

describe("planReconcile", () => {
  it("claims a ready, unclaimed item", () => {
    expect(plan().kind).toBe("claim");
  });

  it("claims an item the board has not seen yet", () => {
    const action = plan({ board: undefined });
    expect(action.kind).toBe("claim");
    if (action.kind === "claim") expect(action.reason).toContain("add and claim");
  });

  it("is a no-op when the same delivery is replayed by the holder", () => {
    const action = plan({ lease: lease() });
    expect(action.kind).toBe("noop");
    if (action.kind === "noop") expect(action.reason).toContain("already claimed");
  });

  it("skips an item another holder has leased", () => {
    expect(plan({ lease: lease({ holder: "vakto@host-b" }) }).kind).toBe("skip");
  });

  it("re-claims after a lease expires", () => {
    const action = plan({ lease: lease({ expiresAt: "2026-10-12T11:00:00.000Z" }) });
    expect(action.kind).toBe("claim");
    if (action.kind === "claim") expect(action.reason).toContain("expired");
  });

  it("does nothing when a human removed the ready label", () => {
    const action = plan({ board: item({ labels: ["needs-triage"], status: "Triage" }) });
    expect(action.kind).toBe("noop");
    if (action.kind === "noop") expect(action.reason).toContain("no longer on the item");
  });

  it("ignores a label that is not the ready label", () => {
    expect(plan({ wake: wake({ label: "documentation" }) }).kind).toBe("noop");
  });

  it("ignores unrelated events", () => {
    expect(plan({ wake: wake({ event: "workflow_run" }) }).kind).toBe("noop");
    expect(plan({ wake: wake({ action: "closed" }) }).kind).toBe("noop");
  });
});

describe("isLeaseValid", () => {
  it("treats a missing or malformed lease as invalid", () => {
    expect(isLeaseValid(undefined, NOW)).toBe(false);
    expect(isLeaseValid(lease({ expiresAt: "not-a-date" }), NOW)).toBe(false);
  });

  it("treats an expiry exactly at now as expired", () => {
    expect(isLeaseValid(lease({ expiresAt: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("honours a live lease", () => {
    expect(isLeaseValid(lease(), NOW)).toBe(true);
  });
});
