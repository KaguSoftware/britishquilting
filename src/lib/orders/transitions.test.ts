import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSITIONS, UNDO_FROM, UNDO_TO, canCancel, canRefund, canTransition, lineStockQty, restockByDefault, type OrderStatus } from "./transitions";

const sql = readFileSync(join(__dirname, "../../../supabase/migrations/20260928180000_order_lifecycle.sql"), "utf8");

/** Pairs from the `insert into public.order_transitions ... values` block. */
function sqlPairs() {
  const block = sql.split("insert into public.order_transitions (from_status, to_status) values")[1]!.split(";")[0]!;
  return [...block.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
}

function sqlList(label: "p_from in" | "p_previous in") {
  const m = sql.match(new RegExp(`${label} \\(([^)]*)\\)`));
  return [...m![1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

describe("transition map parity with SQL", () => {
  it("forward moves match order_transitions exactly", () => {
    const ts = Object.entries(TRANSITIONS)
      .flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`))
      .sort();
    expect(sqlPairs().length).toBeGreaterThan(10);
    expect(ts).toEqual(sqlPairs());
  });

  it("undo lists match can_transition()", () => {
    expect([...UNDO_FROM].sort()).toEqual(sqlList("p_from in"));
    expect([...UNDO_TO].sort()).toEqual(sqlList("p_previous in"));
  });
});

describe("canTransition", () => {
  it("allows the forward flow", () => {
    const flow: OrderStatus[] = ["awaiting_payment", "paid", "processing", "shipped", "delivered"];
    for (let i = 0; i < flow.length - 1; i++) expect(canTransition(flow[i]!, flow[i + 1]!)).toBe(true);
    expect(canTransition("processing", "ready_for_collection")).toBe(true);
    expect(canTransition("ready_for_collection", "collected")).toBe(true);
  });

  it("rejects illegal moves", () => {
    expect(canTransition("delivered", "processing")).toBe(false);
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("refunded", "paid")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });

  it("cancel only before shipped or collected", () => {
    for (const s of ["pending", "awaiting_payment", "paid", "processing", "ready_for_collection"] as const) expect(canCancel(s)).toBe(true);
    for (const s of ["shipped", "delivered", "collected", "cancelled", "refunded"] as const) expect(canCancel(s)).toBe(false);
  });

  it("undo only to the immediately previous status", () => {
    expect(canTransition("processing", "paid", "paid")).toBe(true);
    expect(canTransition("delivered", "shipped", "shipped")).toBe(true);
    expect(canTransition("delivered", "paid", "shipped")).toBe(false);
    expect(canTransition("cancelled", "paid", "paid")).toBe(false);
    expect(canTransition("processing", "paid", null)).toBe(false);
  });

  it("refunds need money taken", () => {
    expect(canRefund("delivered", true)).toBe(true);
    expect(canRefund("awaiting_payment", true)).toBe(false);
    expect(canRefund("processing", false)).toBe(false);
    expect(canRefund("refunded", true)).toBe(false);
  });
});

describe("stock helpers", () => {
  it("counts metres for cut lines, units otherwise", () => {
    expect(lineStockQty({ sale_mode: "metre", length_m: 2.5, quantity: 2 })).toBe(5);
    expect(lineStockQty({ sale_mode: "roll", length_m: null, quantity: 3 })).toBe(3);
    expect(lineStockQty({ sale_mode: "unit", length_m: null, quantity: 1, is_swatch: true })).toBe(0);
    expect(restockByDefault("metre")).toBe(false);
    expect(restockByDefault("unit")).toBe(true);
  });
});
