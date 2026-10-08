import { describe, expect, it } from "vitest";
import {
  addDays,
  cartFingerprint,
  decimalToPence,
  isUkPhone,
  isValidUkPostcode,
  normalisePostcode,
  penceToDecimal,
  safeEqual,
  stableStringify,
  trackingUrlFor,
} from "./helpers";

describe("postcodes", () => {
  it("normalises spacing and case", () => {
    expect(normalisePostcode("sw1a1aa")).toBe("SW1A 1AA");
    expect(normalisePostcode("  ec1v  9hq ")).toBe("EC1V 9HQ");
  });
  it("accepts real formats", () => {
    for (const p of ["SW1A 1AA", "M1 1AE", "B33 8TH", "CR2 6XH", "DN55 1PT", "W1A 0AX", "EC1A 1BB", "GIR 0AA", "n16 7ul"])
      expect(isValidUkPostcode(p), p).toBe(true);
  });
  it("rejects junk", () => {
    for (const p of ["", "12345", "SW1A", "QQ1 1AA", "SW1A 1A", "10001", "SW1A 1AAA"]) expect(isValidUkPostcode(p), p).toBe(false);
  });
});

describe("phone", () => {
  it("accepts UK numbers only", () => {
    expect(isUkPhone("020 7946 0000")).toBe(true);
    expect(isUkPhone("+44 7700 900123")).toBe(true);
    expect(isUkPhone("555-1234")).toBe(false);
  });
});

describe("money conversion", () => {
  it("round trips pence exactly", () => {
    for (const p of [0, 1, 10, 99, 100, 1234, 1999999]) expect(decimalToPence(penceToDecimal(p))).toBe(p);
    expect(penceToDecimal(1205)).toBe("12.05");
    expect(decimalToPence("12.5")).toBe(1250);
    expect(decimalToPence("0.1")).toBe(10);
  });
  it("rejects malformed", () => {
    expect(decimalToPence("12.345")).toBeNull();
    expect(decimalToPence("-1.00")).toBeNull();
    expect(decimalToPence("abc")).toBeNull();
    expect(() => penceToDecimal(1.5)).toThrow();
  });
});

describe("fingerprint", () => {
  const base = { fulfilment: "delivery", rateId: "r1", email: "A@b.com", total: 1000 };
  it("ignores line order and email case", () => {
    const a = cartFingerprint({ ...base, lines: [{ productId: "x", quantity: 1, lengthM: 2 }, { productId: "y", quantity: 1, isSwatch: true }] });
    const b = cartFingerprint({ ...base, email: "a@B.com", lines: [{ productId: "y", quantity: 1, isSwatch: true }, { productId: "x", quantity: 1, lengthM: 2 }] });
    expect(a).toBe(b);
  });
  it("changes with total, quantity or rate", () => {
    const lines = [{ productId: "x", quantity: 1 }];
    const a = cartFingerprint({ ...base, lines });
    expect(cartFingerprint({ ...base, lines, total: 1001 })).not.toBe(a);
    expect(cartFingerprint({ ...base, lines: [{ productId: "x", quantity: 2 }] })).not.toBe(a);
    expect(cartFingerprint({ ...base, lines, rateId: "r2" })).not.toBe(a);
  });
  it("changes with colour", () => {
    const a = cartFingerprint({ ...base, lines: [{ productId: "x", variantId: "ivory", quantity: 1 }] });
    expect(cartFingerprint({ ...base, lines: [{ productId: "x", variantId: "white", quantity: 1 }] })).not.toBe(a);
  });
  it("ignores rate for collection", () => {
    const lines = [{ productId: "x", quantity: 1 }];
    expect(cartFingerprint({ ...base, fulfilment: "collection", lines })).toBe(cartFingerprint({ ...base, fulfilment: "collection", rateId: "zz", lines }));
  });
  it("stableStringify sorts keys", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});

describe("misc", () => {
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
  it("addDays", () => {
    expect(addDays(new Date("2026-01-31T00:00:00Z"), 30).toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
  it("tracking urls", () => {
    expect(trackingUrlFor("royal_mail", "AB123")).toContain("AB123");
    expect(trackingUrlFor("other", "AB123")).toBeNull();
    expect(trackingUrlFor("other", "AB123", "https://x")).toBe("https://x");
  });
});
