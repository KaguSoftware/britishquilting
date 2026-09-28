export type OrderStatus =
  | "pending" | "awaiting_payment" | "paid" | "processing" | "shipped"
  | "ready_for_collection" | "collected" | "delivered" | "cancelled" | "refunded";

export type Tone = "neutral" | "gold" | "aubergine" | "green" | "red" | "blue";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; help: string }> = {
  pending: { label: "Not paid yet", tone: "neutral", help: "Checkout was started but payment has not come through." },
  awaiting_payment: { label: "Awaiting payment", tone: "gold", help: "Waiting for the customer to pay." },
  paid: { label: "New, ready to pack", tone: "aubergine", help: "Paid and waiting to be packed." },
  processing: { label: "Being packed", tone: "blue", help: "Someone is cutting and packing this order." },
  shipped: { label: "Sent", tone: "green", help: "On its way with the courier." },
  ready_for_collection: { label: "Ready to collect", tone: "gold", help: "Packed and waiting on the shelf for the customer." },
  collected: { label: "Collected", tone: "green", help: "The customer has picked it up." },
  delivered: { label: "Delivered", tone: "green", help: "Delivered to the customer." },
  cancelled: { label: "Cancelled", tone: "red", help: "This order was cancelled." },
  refunded: { label: "Refunded", tone: "red", help: "The money has been returned." },
};

/** Tabs on the orders page. Each maps to a set of statuses. */
export const ORDER_TABS = [
  { key: "to_pack", label: "To pack", statuses: ["paid", "processing"] },
  { key: "ready_for_collection", label: "Ready to collect", statuses: ["ready_for_collection"] },
  { key: "shipped", label: "Sent", statuses: ["shipped"] },
  { key: "unpaid", label: "Awaiting payment", statuses: ["pending", "awaiting_payment"] },
  { key: "invoice_unpaid", label: "Unpaid invoices", statuses: [] },
  { key: "done", label: "Completed", statuses: ["collected", "delivered"] },
  { key: "closed", label: "Cancelled & refunded", statuses: ["cancelled", "refunded"] },
  { key: "all", label: "All orders", statuses: [] },
] as const;

export const CARRIERS = [
  { value: "royal_mail", label: "Royal Mail", url: (n: string) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}` },
  { value: "dpd", label: "DPD", url: (n: string) => `https://track.dpd.co.uk/parcels/${encodeURIComponent(n)}` },
  { value: "parcelforce", label: "Parcelforce", url: (n: string) => `https://www.parcelforce.com/track-trace?trackNumber=${encodeURIComponent(n)}` },
  { value: "other", label: "Other courier", url: (_n: string) => "" },
] as const;

export function carrierLabel(value: string) {
  return CARRIERS.find((c) => c.value === value)?.label ?? value;
}

export function buildTrackingUrl(carrier: string, number: string) {
  const c = CARRIERS.find((x) => x.value === carrier);
  return c && number ? c.url(number.trim()) : "";
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function formatDate(d: string | Date | null | undefined) {
  return d ? dateFmt.format(new Date(d)) : "";
}
export function formatDateTime(d: string | Date | null | undefined) {
  return d ? dateTimeFmt.format(new Date(d)) : "";
}

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(d);
}

export type Address = {
  full_name?: string; name?: string; line1?: string; line2?: string; city?: string;
  county?: string; postcode?: string; country?: string; phone?: string; company?: string;
};

export function addressLines(a: Address | null | undefined): string[] {
  if (!a) return [];
  return [a.full_name ?? a.name, a.company, a.line1, a.line2, a.city, a.county, a.postcode, a.country && a.country !== "GB" ? a.country : null]
    .filter((x): x is string => Boolean(x && String(x).trim()));
}

export const SALE_MODE_LABEL = { metre: "per metre", roll: "per roll", unit: "each" } as const;

/** What the cutter needs to read: "Cut 2.5m x 1" / "1 roll" / "3 x" */
export function cutInstruction(item: { sale_mode: string; length_m: number | null; quantity: number; is_swatch: boolean }) {
  if (item.is_swatch) return `Swatch x ${item.quantity}`;
  if (item.sale_mode === "metre") return `Cut ${Number(item.length_m ?? 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}m x ${item.quantity}`;
  if (item.sale_mode === "roll") return `${item.quantity} roll${item.quantity === 1 ? "" : "s"}`;
  return `${item.quantity} x`;
}

export function penceToPounds(p: number | null | undefined) {
  return p == null ? "" : (p / 100).toFixed(2);
}
export function poundsToPence(v: string | number | null | undefined) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export type DiscountRow = {
  id: string;
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number;
  min_subtotal_pence: number;
  max_uses: number | null;
  uses: number;
  once_per_customer: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const shortDate = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(d));
const pounds = (p: number) => (p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`);

/** "20% off orders over £50, until 31 Oct" */
export function discountSummary(d: Pick<DiscountRow, "kind" | "value" | "min_subtotal_pence" | "max_uses" | "once_per_customer" | "starts_at" | "ends_at">) {
  const what = d.kind === "percent" ? `${d.value}% off` : d.kind === "fixed" ? `${pounds(d.value)} off` : "Free delivery on";
  let s = d.kind === "free_shipping" ? `${what} orders` : `${what} orders`;
  if (d.min_subtotal_pence > 0) s += ` over ${pounds(d.min_subtotal_pence)}`;
  const now = Date.now();
  if (d.starts_at && new Date(d.starts_at).getTime() > now) s += `, from ${shortDate(d.starts_at)}`;
  if (d.ends_at) s += `, until ${shortDate(d.ends_at)}`;
  const limits = [d.max_uses ? `first ${d.max_uses} uses` : null, d.once_per_customer ? "once per customer" : null].filter(Boolean);
  if (limits.length) s += ` (${limits.join(", ")})`;
  return s;
}

export function discountState(d: DiscountRow): { label: string; tone: Tone } {
  const now = Date.now();
  if (!d.is_active) return { label: "Switched off", tone: "neutral" };
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return { label: "Ended", tone: "neutral" };
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return { label: "Starts soon", tone: "blue" };
  if (d.max_uses && d.uses >= d.max_uses) return { label: "All used up", tone: "neutral" };
  return { label: "Live", tone: "green" };
}
