import { describe, expect, it } from "vitest";
import {
  bucketKeys,
  bucketUnit,
  computeLedger,
  estimateFee,
  londonMidnight,
  parsePounds,
  previousPeriod,
  resolvePeriod,
  taxYearStart,
  vatFromGross,
  type FinanceOrder,
} from "./calc";

describe("period bounds (Europe/London)", () => {
  it("month in summer starts at 23:00 UTC the day before", () => {
    const p = resolvePeriod("month", new Date("2026-07-15T12:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-07-31T23:00:00.000Z");
    expect(p.toDay).toBe("2026-07-31");
  });

  it("month spanning the October clock change ends at midnight GMT", () => {
    const p = resolvePeriod("month", new Date("2026-10-10T12:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("March spans the spring clock change", () => {
    const p = resolvePeriod("month", new Date("2026-03-20T12:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-03-31T23:00:00.000Z");
  });

  it("midnight on the clock change days", () => {
    expect(londonMidnight(2026, 3, 29).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(londonMidnight(2026, 3, 30).toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(londonMidnight(2026, 10, 25).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(londonMidnight(2026, 10, 26).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("uses the London day, not the UTC day, near midnight", () => {
    // 23:30 UTC on 30 Sept is 00:30 on 1 Oct in London (BST)
    const p = resolvePeriod("month", new Date("2026-09-30T23:30:00Z"));
    expect(p.fromDay).toBe("2026-10-01");
  });

  it("UK tax year runs 6 April to 5 April", () => {
    expect(taxYearStart({ y: 2026, m: 4, d: 5 })).toBe(2025);
    expect(taxYearStart({ y: 2026, m: 4, d: 6 })).toBe(2026);
    const p = resolvePeriod("tax_year", new Date("2027-01-10T12:00:00Z"));
    expect(p.fromDay).toBe("2026-04-06");
    expect(p.toDay).toBe("2027-04-05");
    expect(p.start.toISOString()).toBe("2026-04-05T23:00:00.000Z");
    const prev = previousPeriod(p);
    expect(prev.fromDay).toBe("2025-04-06");
    expect(prev.toDay).toBe("2026-04-05");
  });

  it("last month, quarter, year and their previous periods", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    const lm = resolvePeriod("last_month", now);
    expect([lm.fromDay, lm.toDay]).toEqual(["2025-12-01", "2025-12-31"]);
    expect(previousPeriod(lm).fromDay).toBe("2025-11-01");
    const q = resolvePeriod("quarter", now);
    expect([q.fromDay, q.toDay]).toEqual(["2026-01-01", "2026-03-31"]);
    expect([previousPeriod(q).fromDay, previousPeriod(q).toDay]).toEqual(["2025-10-01", "2025-12-31"]);
    const y = resolvePeriod("year", now);
    expect(previousPeriod(y).fromDay).toBe("2025-01-01");
  });

  it("custom range is inclusive and its previous period has the same length", () => {
    const p = resolvePeriod("custom", new Date(), { from: "2026-09-10", to: "2026-09-19" });
    expect(p.toDay).toBe("2026-09-19");
    const prev = previousPeriod(p);
    expect([prev.fromDay, prev.toDay]).toEqual(["2026-08-31", "2026-09-09"]);
  });

  it("buckets by day, week or month", () => {
    expect(bucketUnit({ fromDay: "2026-09-01", toDay: "2026-09-30" })).toBe("day");
    expect(bucketUnit({ fromDay: "2026-07-01", toDay: "2026-09-30" })).toBe("week");
    expect(bucketUnit({ fromDay: "2026-01-01", toDay: "2026-12-31" })).toBe("month");
    expect(bucketKeys({ fromDay: "2026-09-01", toDay: "2026-09-30" }, "day")).toHaveLength(30);
    expect(bucketKeys({ fromDay: "2026-01-01", toDay: "2026-12-31" }, "month")).toHaveLength(12);
    const w = bucketKeys({ fromDay: "2026-07-01", toDay: "2026-09-30" }, "week");
    expect(w[0]).toBe("2026-06-29");
    expect(w[1]).toBe("2026-07-06");
  });
});

describe("money", () => {
  it("estimates fees per provider", () => {
    expect(estimateFee("stripe", 10000)).toBe(170);
    expect(estimateFee("paypal", 10000)).toBe(320);
    expect(estimateFee("invoice", 10000)).toBe(0);
    expect(estimateFee("stripe", 0)).toBe(0);
    expect(estimateFee("stripe", 1000, { stripe_pct: 2, stripe_fixed_pence: 25, paypal_pct: 0, paypal_fixed_pence: 0, vat_rate: 20 })).toBe(45);
  });

  it("extracts VAT as one sixth of a VAT-inclusive amount", () => {
    expect(vatFromGross(12000)).toBe(2000);
    expect(vatFromGross(1000)).toBe(167);
    expect(vatFromGross(1000, 0)).toBe(0);
  });

  it("parses pounds", () => {
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("£1,200.00")).toBe(120000);
    expect(parsePounds("")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
  });
});

describe("ledger", () => {
  const order = (o: Partial<FinanceOrder>): FinanceOrder => ({
    id: "o",
    total_pence: 12000,
    vat_included_pence: 2000,
    shipping_pence: 600,
    discount_pence: 0,
    payment_provider: "stripe",
    paid_at: "2026-09-10T10:00:00Z",
    is_trade: false,
    items: [],
    ...o,
  });

  it("nets a partial refund and works out profit", () => {
    const l = computeLedger(
      [
        order({
          items: [
            { product_id: "p", is_swatch: false, sale_mode: "metre", length_m: 2.5, quantity: 2, line_total_pence: 10000, cost_pence: 400 },
            { product_id: "p2", is_swatch: false, sale_mode: "unit", length_m: null, quantity: 1, line_total_pence: 1400, cost_pence: null },
            { product_id: "p", is_swatch: true, sale_mode: "metre", length_m: null, quantity: 1, line_total_pence: 0, cost_pence: null },
          ],
        }),
        order({ id: "b", total_pence: 6000, vat_included_pence: 1000, shipping_pence: 0, discount_pence: 500, payment_provider: "invoice", is_trade: true }),
      ],
      [{ order_id: "o", amount_pence: 3000, vat_pence: 500, created_at: "2026-09-12T10:00:00Z" }],
      [{ amount_pence: 2400, vat_pence: 400, spent_on: "2026-09-02" }],
    );
    expect(l.gross).toBe(18000);
    expect(l.refunds).toBe(3000);
    expect(l.net).toBe(15000);
    expect(l.vat).toBe(2500);
    expect(l.revenueExVat).toBe(12500);
    expect(l.fees).toBe(200); // 1.5% of 120 = 1.80 + 0.20, invoice free
    expect(l.cogs).toBe(2000); // 5 m at 4.00
    expect(l.costMissing).toBe(1);
    expect(l.expensesExVat).toBe(2000);
    expect(l.discounts).toBe(500);
    expect(l.profit).toBe(12500 - 200 - 2000 - 2000);
  });

  it("takes goods returned to stock off cost of goods sold", () => {
    const l = computeLedger(
      [order({ items: [{ product_id: "p", is_swatch: false, sale_mode: "unit", length_m: null, quantity: 3, line_total_pence: 2250, cost_pence: 300 }] })],
      [{ order_id: "o", amount_pence: 750, vat_pence: 125, created_at: "2026-09-12T10:00:00Z", returned_cost: 300 }],
      [],
    );
    expect(l.cogs).toBe(600);
  });

  it("is all zeros with nothing in it", () => {
    const l = computeLedger([], [], []);
    expect(l.profit).toBe(0);
    expect(l.costMissing).toBe(0);
  });
});
