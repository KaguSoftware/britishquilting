/**
 * Pure money maths for the finance page. No I/O here so it can be unit tested.
 * All amounts are integer pence. Periods are half-open [start, end) instants whose
 * edges are midnights in Europe/London.
 */

export const TZ = "Europe/London";

export type PeriodKey = "month" | "last_month" | "quarter" | "year" | "tax_year" | "custom";

export type Period = {
  key: PeriodKey;
  start: Date;
  /** exclusive */
  end: Date;
  /** first calendar day, yyyy-mm-dd */
  fromDay: string;
  /** last calendar day (inclusive), yyyy-mm-dd */
  toDay: string;
  label: string;
};

export type Ymd = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, "0");
export const ymdToIso = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;
export function isoToYmd(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function londonParts(d: Date) {
  const p: Record<string, number> = {};
  for (const x of partsFmt.formatToParts(d)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** The London calendar day an instant falls on. */
export function londonDay(d: Date): Ymd {
  const p = londonParts(d);
  return { y: p.year, m: p.month, d: p.day };
}

/** Minutes London is ahead of UTC at an instant (0 in winter, 60 in summer). */
function londonOffsetMinutes(d: Date) {
  const p = londonParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** The instant of midnight at the start of a London calendar day. Month/day may overflow (Date.UTC normalises). */
export function londonMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - londonOffsetMinutes(new Date(guess)) * 60000;
  // Re-check once in case the guess sat on the other side of a clock change.
  t = guess - londonOffsetMinutes(new Date(t)) * 60000;
  return new Date(t);
}

const addDays = ({ y, m, d }: Ymd, n: number): Ymd => {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const norm = (y: number, m: number, d: number) => addDays({ y, m, d }, 0);

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtDay = (x: Ymd) => dayFmt.format(new Date(Date.UTC(x.y, x.m - 1, x.d)));

function build(key: PeriodKey, from: Ymd, toExcl: Ymd, label?: string): Period {
  const last = addDays(toExcl, -1);
  return {
    key,
    start: londonMidnight(from.y, from.m, from.d),
    end: londonMidnight(toExcl.y, toExcl.m, toExcl.d),
    fromDay: ymdToIso(from),
    toDay: ymdToIso(last),
    label: label ?? `${fmtDay(from)} to ${fmtDay(last)}`,
  };
}

/** UK tax year that contains a London day: starts 6 April. Returns the starting year. */
export function taxYearStart(day: Ymd) {
  return day.m > 4 || (day.m === 4 && day.d >= 6) ? day.y : day.y - 1;
}

export function resolvePeriod(key: PeriodKey, now: Date, custom?: { from?: string | null; to?: string | null }): Period {
  const t = londonDay(now);
  switch (key) {
    case "last_month": {
      const from = norm(t.y, t.m - 1, 1);
      return build(key, from, { y: t.y, m: t.m, d: 1 }, monthFmt.format(new Date(Date.UTC(from.y, from.m - 1, 1))));
    }
    case "quarter": {
      const qm = Math.floor((t.m - 1) / 3) * 3 + 1;
      return build(key, { y: t.y, m: qm, d: 1 }, norm(t.y, qm + 3, 1), `Q${(qm + 2) / 3} ${t.y}`);
    }
    case "year":
      return build(key, { y: t.y, m: 1, d: 1 }, { y: t.y + 1, m: 1, d: 1 }, String(t.y));
    case "tax_year": {
      const y = taxYearStart(t);
      return build(key, { y, m: 4, d: 6 }, { y: y + 1, m: 4, d: 6 }, `Tax year ${y} to ${String(y + 1).slice(2)}`);
    }
    case "custom": {
      const a = custom?.from ? isoToYmd(custom.from) : null;
      const b = custom?.to ? isoToYmd(custom.to) : null;
      if (a && b) {
        const [lo, hi] = ymdToIso(a) <= ymdToIso(b) ? [a, b] : [b, a];
        return build("custom", lo, addDays(hi, 1));
      }
      return resolvePeriod("month", now);
    }
    default:
      return build("month", { y: t.y, m: t.m, d: 1 }, norm(t.y, t.m + 1, 1), monthFmt.format(new Date(Date.UTC(t.y, t.m - 1, 1))));
  }
}

/** The period just before, of the same kind (same length in days for custom ranges). */
export function previousPeriod(p: Period): Period {
  const from = isoToYmd(p.fromDay)!;
  const to = addDays(isoToYmd(p.toDay)!, 1);
  switch (p.key) {
    case "month":
    case "last_month":
      return build(p.key, norm(from.y, from.m - 1, 1), from, monthFmt.format(new Date(Date.UTC(from.y, from.m - 2, 1))));
    case "quarter": {
      const s = norm(from.y, from.m - 3, 1);
      return build(p.key, s, from, `Q${(s.m + 2) / 3} ${s.y}`);
    }
    case "year":
      return build(p.key, { y: from.y - 1, m: 1, d: 1 }, from, String(from.y - 1));
    case "tax_year":
      return build(p.key, { y: from.y - 1, m: 4, d: 6 }, from, `Tax year ${from.y - 1} to ${String(from.y).slice(2)}`);
    default: {
      const days = Math.round((Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 86400000);
      return build("custom", addDays(from, -days), from);
    }
  }
}

/* ───────────────────────── money */

export type FeeSettings = {
  stripe_pct: number;
  stripe_fixed_pence: number;
  paypal_pct: number;
  paypal_fixed_pence: number;
  vat_rate: number;
};

export const DEFAULT_FEES: FeeSettings = { stripe_pct: 1.5, stripe_fixed_pence: 20, paypal_pct: 2.9, paypal_fixed_pence: 30, vat_rate: 20 };

/** Estimated card or PayPal fee on one charge. Invoices (bank transfer) cost nothing. */
export function estimateFee(provider: string | null | undefined, grossPence: number, s: FeeSettings = DEFAULT_FEES) {
  if (grossPence <= 0) return 0;
  if (provider === "stripe") return Math.round((grossPence * Number(s.stripe_pct)) / 100) + Number(s.stripe_fixed_pence);
  if (provider === "paypal") return Math.round((grossPence * Number(s.paypal_pct)) / 100) + Number(s.paypal_fixed_pence);
  return 0;
}

/** VAT inside a VAT-inclusive amount. At 20% this is one sixth. */
export function vatFromGross(grossPence: number, ratePct = 20) {
  return Math.round((grossPence * ratePct) / (100 + ratePct));
}

/** Stock a line uses: metres for cut lines, otherwise one per unit or roll. */
export function lineQty(mode: string, lengthM: number | string | null | undefined, quantity: number) {
  return mode === "metre" ? Number(lengthM ?? 0) * quantity : quantity;
}

export type FinanceItem = {
  product_id: string | null;
  is_swatch: boolean;
  sale_mode: string;
  length_m: number | string | null;
  quantity: number;
  line_total_pence: number;
  cost_pence: number | null;
};

export type FinanceOrder = {
  id: string;
  total_pence: number;
  vat_included_pence: number;
  shipping_pence: number;
  discount_pence: number;
  payment_provider: string | null;
  paid_at: string;
  is_trade: boolean;
  items: FinanceItem[];
  /** Fee actually charged when this order was paid, frozen at that time. Null for orders that predate the snapshot. */
  fee_pence?: number | null;
  /** VAT rate this order was placed at. Defaults to 20 for orders that predate the column. */
  vat_rate?: number | null;
};

/** returned_cost: cost price of goods this refund put back on the shelf, which stops being cost of goods sold. */
export type FinanceRefund = { order_id: string; amount_pence: number; vat_pence: number; created_at: string; returned_cost?: number };
export type FinanceExpense = { amount_pence: number; vat_pence: number; spent_on: string };
/** A Stripe dispute's balance-transaction line: amount_pence is signed, negative when funds are taken, positive when returned. */
export type FinanceChargeback = { amount_pence: number; fee_pence: number; created_at: string };

/** The fee actually charged, if snapshotted when the order was paid; otherwise an estimate at today's rates. */
export function orderFee(o: Pick<FinanceOrder, "payment_provider" | "total_pence" | "fee_pence">, s: FeeSettings = DEFAULT_FEES) {
  return o.fee_pence ?? estimateFee(o.payment_provider, o.total_pence, s);
}

/** Cost of goods for one order and how many product lines had no cost price (and their sales, before VAT). */
export function orderCogs(items: FinanceItem[], vatRatePct = 20) {
  let cogs = 0;
  let missing = 0;
  let missingSalesGross = 0;
  for (const i of items) {
    if (i.is_swatch) continue;
    if (i.cost_pence == null) {
      missing++;
      missingSalesGross += i.line_total_pence;
    } else {
      cogs += i.cost_pence * lineQty(i.sale_mode, i.length_m, i.quantity);
    }
  }
  return { cogs: Math.round(cogs), missing, missingSales: Math.round(missingSalesGross - vatFromGross(missingSalesGross, vatRatePct)) };
}

export type Ledger = {
  orders: number;
  gross: number;
  refunds: number;
  net: number;
  vat: number;
  revenueExVat: number;
  shipping: number;
  discounts: number;
  fees: number;
  cogs: number;
  costMissing: number;
  /** Sales, before VAT, on lines with no cost price: how much of revenue the costMissing warning covers. */
  costMissingSales: number;
  /** Money taken back by lost card disputes in this period, net of any later reinstatement. */
  chargebacks: number;
  /** Dispute fees the provider charged, e.g. Stripe's dispute fee. */
  disputeFees: number;
  expensesExVat: number;
  expensesVat: number;
  profit: number;
};

export function computeLedger(
  orders: FinanceOrder[],
  refunds: FinanceRefund[],
  expenses: FinanceExpense[],
  s: FeeSettings = DEFAULT_FEES,
  chargebacks: FinanceChargeback[] = [],
): Ledger {
  let gross = 0, vatSales = 0, shipping = 0, discounts = 0, fees = 0, cogs = 0, costMissing = 0, costMissingSales = 0;
  for (const o of orders) {
    gross += o.total_pence;
    vatSales += o.vat_included_pence;
    shipping += o.shipping_pence;
    discounts += o.discount_pence;
    fees += orderFee(o, s);
    const c = orderCogs(o.items, o.vat_rate ?? 20);
    cogs += c.cogs;
    costMissing += c.missing;
    costMissingSales += c.missingSales;
  }
  const refundTotal = refunds.reduce((a, r) => a + r.amount_pence, 0);
  const refundVat = refunds.reduce((a, r) => a + r.vat_pence, 0);
  cogs -= refunds.reduce((a, r) => a + (r.returned_cost ?? 0), 0);
  const expensesGross = expenses.reduce((a, e) => a + e.amount_pence, 0);
  const expensesVat = expenses.reduce((a, e) => a + e.vat_pence, 0);
  // Chargeback amounts are signed (negative = taken, positive = reinstated); a net negative sum is money lost.
  const chargebackNet = chargebacks.reduce((a, c) => a + c.amount_pence, 0);
  const chargebackTaken = Math.max(0, -chargebackNet);
  const disputeFees = chargebacks.reduce((a, c) => a + c.fee_pence, 0);
  const net = gross - refundTotal - chargebackTaken;
  const vat = vatSales - refundVat;
  const revenueExVat = net - vat;
  const expensesExVat = expensesGross - expensesVat;
  return {
    orders: orders.length,
    gross,
    refunds: refundTotal,
    net,
    vat,
    revenueExVat,
    shipping,
    discounts,
    fees,
    cogs,
    costMissing,
    costMissingSales,
    chargebacks: chargebackTaken,
    disputeFees,
    expensesExVat,
    expensesVat,
    profit: revenueExVat - fees - disputeFees - cogs - expensesExVat,
  };
}

/** Percentage change, or null when there is nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

/* ───────────────────────── buckets for charts */

export type BucketUnit = "day" | "week" | "month";

export function bucketUnit(p: Pick<Period, "fromDay" | "toDay">): BucketUnit {
  const a = isoToYmd(p.fromDay)!, b = isoToYmd(p.toDay)!;
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000) + 1;
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
}

/** Bucket key (yyyy-mm-dd of the bucket's first day) for a London day. Weeks start Monday. */
export function bucketKey(day: Ymd, unit: BucketUnit): string {
  if (unit === "month") return ymdToIso({ y: day.y, m: day.m, d: 1 });
  if (unit === "week") {
    const dow = (new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() + 6) % 7;
    return ymdToIso(addDays(day, -dow));
  }
  return ymdToIso(day);
}

/** Every bucket key in a period, in order. */
export function bucketKeys(p: Pick<Period, "fromDay" | "toDay">, unit: BucketUnit): string[] {
  const out: string[] = [];
  let cur = isoToYmd(p.fromDay)!;
  const last = p.toDay;
  while (ymdToIso(cur) <= last) {
    const k = bucketKey(cur, unit);
    if (out[out.length - 1] !== k) out.push(k);
    cur = unit === "month" ? norm(cur.y, cur.m + 1, 1) : addDays(cur, unit === "week" ? 7 - ((new Date(Date.UTC(cur.y, cur.m - 1, cur.d)).getUTCDay() + 6) % 7) : 1);
  }
  return out;
}

/** Pounds text to pence, e.g. "12.5" to 1250. Null for empty or invalid. */
export function parsePounds(v: string | null | undefined): number | null {
  const s = String(v ?? "").replace(/[£,\s]/g, "");
  if (!s) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
