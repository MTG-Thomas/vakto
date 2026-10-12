/**
 * Public surface of the vakto supervisor contract.
 *
 * Everything exported here is pure and side-effect free. I/O — board reads,
 * ledger writes, dispatch — lives behind these decisions.
 */

export {
  deriveIdempotencyKey,
  isLeaseValid,
  planReconcile,
  type BoardItem,
  type Lease,
  type ReconcileAction,
  type ReconcileInput,
  type WakeEvent,
} from "./contract.ts";
