/**
 * Pure checkout helpers shared by the client form and the server action.
 * No server or browser APIs in here so they stay unit testable.
 */

/** Full UK postcode, including the special GIR 0AA. */
const UK_POSTCODE =
  /^(GIR ?0AA|(?:[A-PR-UWYZ][0-9][0-9]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9]?|[A-PR-UWYZ][0-9][A-HJKPSTUW]|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRVWXY]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/;

/** "sw1a1aa" becomes "SW1A 1AA". Returns the trimmed upper-case input when it can't be shaped. */
export function normalisePostcode(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5 || compact.length > 7) return raw.trim().toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(raw: string) {
  return UK_POSTCODE.test(normalisePostcode(raw));
}

export function isUkPhone(raw: string) {
  const digits = raw.replace(/[\s()-]/g, "");
  return /^(\+44|0044|0)\d{9,10}$/.test(digits);
}

/** Deterministic JSON: object keys sorted, so equal carts produce equal strings. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

type HashLine = { productId: string; variantId?: string; lengthM?: number; quantity: number; isSwatch?: boolean };

/** Canonical cart fingerprint, independent of line order. Hash it server side. */
export function cartFingerprint(input: {
  lines: HashLine[];
  fulfilment: string;
  rateId?: string | null;
  discountCode?: string | null;
  email: string;
  address?: unknown;
  total: number;
}) {
  const lines = input.lines
    .map((l) => ({ p: l.productId, v: l.variantId ?? null, l: l.lengthM ?? null, q: l.quantity, s: Boolean(l.isSwatch) }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  return stableStringify({
    lines,
    f: input.fulfilment,
    r: input.fulfilment === "collection" ? null : (input.rateId ?? null),
    d: input.discountCode?.trim().toUpperCase() || null,
    e: input.email.trim().toLowerCase(),
    a: input.address ?? null,
    t: input.total,
  });
}

/** PayPal wants "12.34" strings; we store integer pence. */
export function penceToDecimal(pence: number) {
  if (!Number.isInteger(pence) || pence < 0) throw new Error("pence must be a non-negative integer");
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}`;
}

/** "12.34" becomes 1234, exactly (no float maths). Returns null for anything malformed. */
export function decimalToPence(value: string | null | undefined) {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Constant time string compare for access tokens. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const TRACKING: Record<string, (n: string) => string> = {
  royal_mail: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}`,
  dpd: (n) => `https://track.dpd.co.uk/parcels/${encodeURIComponent(n)}`,
  parcelforce: (n) => `https://www.parcelforce.com/track-trace?trackNumber=${encodeURIComponent(n)}`,
  evri: (n) => `https://www.evri.com/track/parcel/${encodeURIComponent(n)}`,
  dhl: (n) => `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
};

export function trackingUrlFor(carrier: string, number: string, explicit?: string | null) {
  if (explicit) return explicit;
  const key = carrier.toLowerCase().replace(/[\s-]+/g, "_");
  return TRACKING[key]?.(number) ?? null;
}

export function carrierLabel(carrier: string) {
  const map: Record<string, string> = { royal_mail: "Royal Mail", dpd: "DPD", parcelforce: "Parcelforce", evri: "Evri", dhl: "DHL" };
  return map[carrier.toLowerCase()] ?? carrier;
}
