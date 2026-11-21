import { describe, expect, it } from "vitest";
import { allocation, allocationErrors, destinationLines, destinationTotal, linesByPlace, placesSummary, type Destination } from "./delivery-notes";

const lines = [
  { code: "LIN3", description: "Cotton Sateen Lining", quantity: 5, unit_price_pence: 495 },
  { code: "INT1", description: "Bump Interlining", quantity: 2, unit_price_pence: 1200 },
];

const split = (a: number, b: number): Destination[] => [
  { label: "Site A", address: "1 High St", items: [{ line: 0, qty: a }, { line: 1, qty: 2 }] },
  { label: "Site B", address: "2 Low Rd", items: [{ line: 0, qty: b }] },
];

describe("splitting an invoice across places", () => {
  it("adds up each line across places", () => {
    expect(allocation(lines, split(2, 3))).toEqual([
      { line: 0, ordered: 5, allocated: 5, remaining: 0 },
      { line: 1, ordered: 2, allocated: 2, remaining: 0 },
    ]);
  });

  it("only saves when the quantities match the invoice exactly", () => {
    expect(allocationErrors(lines, split(2, 3))).toEqual([]);
    expect(allocationErrors(lines, split(2, 2))).toEqual(["1 of Cotton Sateen Lining still need a place."]);
    expect(allocationErrors(lines, split(3, 3))).toEqual(["1 too many of Cotton Sateen Lining: the invoice has 5."]);
  });

  it("needs an address and something for every place", () => {
    const errs = allocationErrors(lines, [...split(2, 3), { label: "", address: "", items: [] }]);
    expect(errs).toContain("Place 3 has nothing going to it.");
    expect(errs).toContain('Place 3 needs an address (or "Collected").');
  });

  it("copes with fractional metres", () => {
    const l = [{ code: "A", description: "Linen", quantity: 1.5, unit_price_pence: 1000 }];
    const d: Destination[] = [
      { label: "", address: "x", items: [{ line: 0, qty: 0.7 }] },
      { label: "", address: "y", items: [{ line: 0, qty: 0.8 }] },
    ];
    expect(allocationErrors(l, d)).toEqual([]);
  });

  it("prices each place and lists its lines", () => {
    const d = split(2, 3);
    expect(destinationTotal(lines, d[0])).toBe(2 * 495 + 2 * 1200);
    expect(destinationTotal(lines, d[1])).toBe(3 * 495);
    const saved = destinationLines(lines, d);
    expect(saved.map((l) => [l.place, l.code, l.qty])).toEqual([
      [0, "LIN3", 2],
      [0, "INT1", 2],
      [1, "LIN3", 3],
    ]);
    expect(linesByPlace(saved, 2).map((g) => g.length)).toEqual([2, 1]);
  });

  it("puts older notes' lines in the first place and summarises places", () => {
    expect(linesByPlace([{ quantity: "2", description: "x", amount_pence: null }], 1)[0]).toHaveLength(1);
    expect(placesSummary(split(2, 3), null)).toBe("Site A +1 more");
    expect(placesSummary([], "1 High St\nLondon")).toBe("1 High St");
  });
});
