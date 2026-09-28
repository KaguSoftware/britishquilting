/**
 * TypeScript mirror of public.order_transitions and public.can_transition()
 * (supabase/migrations/20260928180000_order_lifecycle.sql). The database is the
 * authority; this copy only decides which buttons to show. transitions.test.ts
 * parses the migration and fails if the two drift apart.
 */

export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "ready_for_collection"
  | "collected"
  | "delivered"
  | "cancelled"
  | "refunded";

export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["awaiting_payment", "paid", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["processing", "shipped", "ready_for_collection", "cancelled", "refunded"],
  processing: ["shipped", "ready_for_collection", "cancelled", "refunded"],
  ready_for_collection: ["collected", "shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  collected: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

/** Statuses staff may step back out of, and the statuses they may step back to. */
export const UNDO_FROM: readonly OrderStatus[] = ["processing", "shipped", "ready_for_collection", "collected", "delivered"];
export const UNDO_TO: readonly OrderStatus[] = ["paid", "processing", "shipped", "ready_for_collection"];

export function canTransition(from: OrderStatus, to: OrderStatus, previous?: OrderStatus | null): boolean {
  if (TRANSITIONS[from]?.includes(to)) return true;
  return previous != null && to === previous && UNDO_FROM.includes(from) && UNDO_TO.includes(previous);
}

export const canCancel = (s: OrderStatus) => canTransition(s, "cancelled");

/** Refunds are possible on anything that could still reach "refunded", as long as money was taken. */
export const canRefund = (s: OrderStatus, paid: boolean) => paid && canTransition(s, "refunded");

/** Whether a cut metre line should go back on the shelf by default (it can't: it's been cut). */
export const restockByDefault = (saleMode: "metre" | "roll" | "unit") => saleMode !== "metre";

/** Stock a line took: metres for cut lines, otherwise one per unit or roll. */
export function lineStockQty(i: { sale_mode: "metre" | "roll" | "unit"; length_m: number | null; quantity: number; is_swatch?: boolean }) {
  if (i.is_swatch) return 0;
  return i.sale_mode === "metre" ? Number(i.length_m ?? 0) * i.quantity : i.quantity;
}
