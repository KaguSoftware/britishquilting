import { describe, expect, it } from "vitest";
import { quote, validateLine, type PricedProduct, type ShippingRate } from "./pricing";

const lining: PricedProduct = {
  id: "lining", name: "Lining", sale_mode: "metre", price_pence: 495,
  min_length_m: 0.5, length_step_m: 0.5, max_length_m: null, weight_g_per_unit: 180,
  swatch_enabled: true, swatch_price_pence: 0, stock_qty: 10, track_stock: true,
};
const roll: PricedProduct = { ...lining, id: "roll", sale_mode: "roll", price_pence: 37500, weight_g_per_unit: 21000, stock_qty: 2 };
const paper: PricedProduct = { ...lining, id: "paper", sale_mode: "unit", price_pence: 1250, weight_g_per_unit: 600, stock_qty: 5 };

const rates: ShippingRate[] = [
  { id: "rm-s", name: "RM small", carrier: "royal_mail", min_weight_g: 0, max_weight_g: 2000, price_pence: 495, estimated_days: null },
  { id: "rm-l", name: "RM large", carrier: "royal_mail", min_weight_g: 2001, max_weight_g: 10000, price_pence: 895, estimated_days: null },
  { id: "dpd", name: "DPD", carrier: "dpd", min_weight_g: 0, max_weight_g: 30000, price_pence: 1295, estimated_days: null },
  { id: "pf", name: "PF", carrier: "parcelforce", min_weight_g: 30001, max_weight_g: null, price_pence: 2495, estimated_days: null },
];

const base = { products: [lining, roll, paper], rates, fulfilment: "delivery" as const, discount: null, freeThreshold: 7500, vatRatePct: 20 };

describe("validateLine", () => {
  it("enforces min length and step", () => {
    expect(validateLine(lining, { productId: "lining", lengthM: 0.25, quantity: 1 })).toBe("below_min");
    expect(validateLine(lining, { productId: "lining", lengthM: 1.3, quantity: 1 })).toBe("bad_step");
    expect(validateLine(lining, { productId: "lining", lengthM: 2.5, quantity: 1 })).toBeNull();
  });
  it("checks stock across pieces", () => {
    expect(validateLine(lining, { productId: "lining", lengthM: 3, quantity: 4 })).toBe("out_of_stock");
  });
  it("only allows single swatches", () => {
    expect(validateLine(lining, { productId: "lining", quantity: 2, isSwatch: true })).toBe("bad_quantity");
  });
});

describe("quote", () => {
  it("prices metres and picks cheapest rate by weight", () => {
    const q = quote({ ...base, lines: [{ productId: "lining", lengthM: 2.5, quantity: 1 }] });
    expect(q.subtotal).toBe(1238); // 4.95 * 2.5 = 12.375 → 1238p
    expect(q.weightG).toBe(450);
    expect(q.selectedRate?.id).toBe("rm-s");
    expect(q.shipping).toBe(495);
    expect(q.total).toBe(1733);
    expect(q.valid).toBe(true);
  });

  it("makes the cheapest service free over the threshold but not faster ones", () => {
    const lines = [{ productId: "paper", quantity: 5 }, { productId: "lining", lengthM: 3, quantity: 1 }]; // £62.50 + £14.85 = £77.35
    expect(quote({ ...base, lines }).shipping).toBe(0);
    expect(quote({ ...base, lines, rateId: "dpd" }).shipping).toBe(1295);
  });

  it("prevents two lines from overselling together", () => {
    const q = quote({ ...base, lines: [
      { productId: "lining", lengthM: 6, quantity: 1 },
      { productId: "lining", lengthM: 5, quantity: 1 },
    ] });
    expect(q.lines[1].error).toBe("out_of_stock");
    expect(q.valid).toBe(false);
  });

  it("applies percent discounts before the free-shipping check", () => {
    const q = quote({ ...base, lines: [{ productId: "paper", quantity: 5 }],
      discount: { code: "TEN", kind: "percent", value: 20, min_subtotal_pence: 0 } });
    expect(q.subtotal).toBe(6250);
    expect(q.discount).toBe(1250);
    expect(q.shipping).toBe(895); // 5000 < 7500
  });

  it("collection is free and needs no rate", () => {
    const q = quote({ ...base, fulfilment: "collection", lines: [{ productId: "roll", quantity: 1 }] });
    expect(q.shipping).toBe(0);
    expect(q.valid).toBe(true);
  });

  it("computes VAT included at the given rate, not a hardcoded 20%", () => {
    const q = quote({ ...base, fulfilment: "collection", lines: [{ productId: "paper", quantity: 1 }] });
    expect(q.vat).toBe(208); // 1250 - 1250/1.2
    expect(q.vatRate).toBe(20);

    const zero = quote({ ...base, vatRatePct: 0, fulfilment: "collection", lines: [{ productId: "paper", quantity: 1 }] });
    expect(zero.vat).toBe(0);
    expect(zero.vatRate).toBe(0);

    const reduced = quote({ ...base, vatRatePct: 17.5, fulfilment: "collection", lines: [{ productId: "paper", quantity: 1 }] });
    expect(reduced.vat).toBe(186); // 1250 - 1250/1.175 = 186.17
  });
});

describe("colours", () => {
  const sateen: PricedProduct = {
    ...lining,
    id: "sateen",
    stock_qty: 12,
    variants: [
      { id: "ivory", name: "Ivory", stock_qty: 10 },
      { id: "sage", name: "Sage", stock_qty: 2 },
    ],
  };
  const withColours = { ...base, products: [sateen] };

  it("needs a colour for cut lines but not for swatches", () => {
    expect(validateLine(sateen, { productId: "sateen", lengthM: 1, quantity: 1 })).toBe("choose_colour");
    expect(validateLine(sateen, { productId: "sateen", quantity: 1, isSwatch: true })).toBeNull();
    expect(validateLine(sateen, { productId: "sateen", variantId: "sage", quantity: 1, isSwatch: true })).toBeNull();
  });

  it("rejects a colour the product doesn't have", () => {
    expect(validateLine(sateen, { productId: "sateen", variantId: "teal", lengthM: 1, quantity: 1 })).toBe("unavailable");
    expect(validateLine(lining, { productId: "lining", variantId: "ivory", lengthM: 1, quantity: 1 })).toBe("unavailable");
  });

  it("checks stock against the chosen colour, not the total", () => {
    expect(validateLine(sateen, { productId: "sateen", variantId: "sage", lengthM: 3, quantity: 1 })).toBe("out_of_stock");
    expect(validateLine(sateen, { productId: "sateen", variantId: "ivory", lengthM: 3, quantity: 1 })).toBeNull();
  });

  it("adds up lines per colour so two cuts can't jointly oversell one", () => {
    const q = quote({
      ...withColours,
      lines: [
        { productId: "sateen", variantId: "sage", lengthM: 1.5, quantity: 1 },
        { productId: "sateen", variantId: "sage", lengthM: 1, quantity: 1 },
        { productId: "sateen", variantId: "ivory", lengthM: 5, quantity: 1 },
      ],
    });
    expect(q.lines.map((l) => l.error)).toEqual([null, "out_of_stock", null]);
  });
});
