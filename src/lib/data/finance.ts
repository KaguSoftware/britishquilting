import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bucketKey,
  bucketKeys,
  bucketUnit,
  computeLedger,
  DEFAULT_FEES,
  estimateFee,
  lineQty,
  londonDay,
  orderCogs,
  type BucketUnit,
  type FeeSettings,
  type FinanceExpense,
  type FinanceOrder,
  type FinanceRefund,
  type Ledger,
  type Period,
} from "@/lib/finance/calc";

export type ExpenseRow = {
  id: string;
  spent_on: string;
  supplier: string;
  category: string;
  amount_pence: number;
  vat_pence: number;
  note: string | null;
  receipt_path: string | null;
};

export type UnpaidInvoice = {
  id: string;
  number: number;
  name: string;
  total_pence: number;
  created_at: string;
  invoice_due_at: string | null;
  overdue: boolean;
};

export type Slice = { key: string; label: string; value: number };
export type Bucket = { key: string; revenue: number; profit: number };
export type TopProduct = { key: string; name: string; revenue: number; qty: number; unit: string };

export type FinanceData = {
  settings: FeeSettings;
  ledger: Ledger;
  previous: Ledger;
  unit: BucketUnit;
  buckets: Bucket[];
  byCategory: Slice[];
  byMethod: Slice[];
  byChannel: Slice[];
  topByRevenue: TopProduct[];
  topByQty: TopProduct[];
  invoicedUnpaid: { count: number; total: number };
  unpaid: UnpaidInvoice[];
  expenses: ExpenseRow[];
};

const ORDER_COLS =
  "id, number, total_pence, vat_included_pence, shipping_pence, discount_pence, payment_provider, paid_at, is_trade, order_items(product_id, name, is_swatch, sale_mode, length_m, quantity, line_total_pence, cost_pence)";

/** Supabase caps a select at 1000 rows, so page through. */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type OrderRow = Omit<FinanceOrder, "items"> & {
  number: number;
  order_items: (FinanceOrder["items"][number] & { name: string })[];
};

export async function loadOrders(db: SupabaseClient, start: Date, end: Date) {
  return all<OrderRow>((a, b) =>
    db.from("orders").select(ORDER_COLS).not("paid_at", "is", null).gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()).order("paid_at").range(a, b),
  );
}
export async function loadRefunds(db: SupabaseClient, start: Date, end: Date) {
  return all<FinanceRefund>((a, b) =>
    db.from("order_refunds").select("order_id, amount_pence, vat_pence, created_at").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at").range(a, b),
  );
}
export async function loadExpenses(db: SupabaseClient, fromDay: string, toDay: string) {
  return all<ExpenseRow>((a, b) =>
    db.from("expenses").select("id, spent_on, supplier, category, amount_pence, vat_pence, note, receipt_path").gte("spent_on", fromDay).lte("spent_on", toDay).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).range(a, b),
  );
}
export async function loadSettings(db: SupabaseClient): Promise<FeeSettings> {
  const { data } = await db.from("finance_settings").select("stripe_pct, stripe_fixed_pence, paypal_pct, paypal_fixed_pence, vat_rate").maybeSingle();
  if (!data) return DEFAULT_FEES;
  return {
    stripe_pct: Number(data.stripe_pct),
    stripe_fixed_pence: Number(data.stripe_fixed_pence),
    paypal_pct: Number(data.paypal_pct),
    paypal_fixed_pence: Number(data.paypal_fixed_pence),
    vat_rate: Number(data.vat_rate),
  };
}

const asFinance = (o: OrderRow): FinanceOrder => ({ ...o, items: o.order_items ?? [] });
const METHOD: Record<string, string> = { stripe: "Card (Stripe)", paypal: "PayPal", invoice: "Trade invoice" };
const UNIT: Record<string, string> = { metre: "m", roll: "rolls", unit: "units" };

export async function loadFinance(db: SupabaseClient, period: Period, prev: Period): Promise<FinanceData> {
  const [settings, orders, prevOrders, refunds, prevRefunds, expenses, prevExpenses, unpaidRes, invoicedRes, productsRes, categoriesRes] = await Promise.all([
    loadSettings(db),
    loadOrders(db, period.start, period.end),
    loadOrders(db, prev.start, prev.end),
    loadRefunds(db, period.start, period.end),
    loadRefunds(db, prev.start, prev.end),
    loadExpenses(db, period.fromDay, period.toDay),
    loadExpenses(db, prev.fromDay, prev.toDay),
    db
      .from("orders")
      .select("id, number, email, total_pence, created_at, invoice_due_at, shipping_address, billing_address")
      .eq("payment_provider", "invoice")
      .is("paid_at", null)
      .not("status", "in", "(cancelled,refunded)")
      .order("invoice_due_at", { ascending: true, nullsFirst: false }),
    db
      .from("orders")
      .select("total_pence")
      .eq("payment_provider", "invoice")
      .is("paid_at", null)
      .not("status", "in", "(cancelled,refunded)")
      .gte("created_at", period.start.toISOString())
      .lt("created_at", period.end.toISOString()),
    db.from("products").select("id, name, sale_mode, category_id"),
    db.from("categories").select("id, name"),
  ]);

  const fin = orders.map(asFinance);
  const ledger = computeLedger(fin, refunds, expenses as FinanceExpense[], settings);
  const previous = computeLedger(prevOrders.map(asFinance), prevRefunds, prevExpenses as FinanceExpense[], settings);

  // Revenue and profit per bucket, each piece in the bucket of its own date.
  const unit = bucketUnit(period);
  const keys = bucketKeys(period, unit);
  const map = new Map(keys.map((k) => [k, { key: k, revenue: 0, profit: 0 }]));
  const exVatShare = (gross: number, vat: number) => gross - vat;
  for (const o of fin) {
    const b = map.get(bucketKey(londonDay(new Date(o.paid_at)), unit));
    if (!b) continue;
    const rev = exVatShare(o.total_pence, o.vat_included_pence);
    b.revenue += rev;
    b.profit += rev - estimateFee(o.payment_provider, o.total_pence, settings) - orderCogs(o.items).cogs;
  }
  for (const r of refunds) {
    const b = map.get(bucketKey(londonDay(new Date(r.created_at)), unit));
    if (!b) continue;
    b.revenue -= r.amount_pence - r.vat_pence;
    b.profit -= r.amount_pence - r.vat_pence;
  }
  for (const e of expenses) {
    const [y, m, d] = e.spent_on.split("-").map(Number);
    const b = map.get(bucketKey({ y, m, d }, unit));
    if (b) b.profit -= e.amount_pence - e.vat_pence;
  }

  // Breakdowns (by paid orders in the period, VAT-inclusive takings).
  const products = new Map((productsRes.data ?? []).map((p) => [p.id as string, p]));
  const categories = new Map((categoriesRes.data ?? []).map((c) => [c.id as string, c.name as string]));
  const cat = new Map<string, Slice>();
  const method = new Map<string, Slice>();
  const channel = new Map<string, Slice>();
  const prod = new Map<string, TopProduct>();
  const add = (m: Map<string, Slice>, key: string, label: string, v: number) => {
    const s = m.get(key) ?? { key, label, value: 0 };
    s.value += v;
    m.set(key, s);
  };
  for (const o of orders) {
    add(method, o.payment_provider ?? "other", METHOD[o.payment_provider ?? ""] ?? "Other", o.total_pence);
    add(channel, o.is_trade ? "trade" : "retail", o.is_trade ? "Trade" : "Retail", o.total_pence);
    for (const i of o.order_items ?? []) {
      const p = i.product_id ? products.get(i.product_id) : null;
      if (i.is_swatch) {
        add(cat, "swatches", "Swatches", i.line_total_pence);
        continue;
      }
      const cid = (p?.category_id as string | null) ?? null;
      add(cat, cid ?? "none", cid ? categories.get(cid) ?? "Other" : "No category", i.line_total_pence);
      const key = i.product_id ?? `name:${i.name}`;
      const t = prod.get(key) ?? { key, name: (p?.name as string) ?? i.name, revenue: 0, qty: 0, unit: UNIT[i.sale_mode] ?? "" };
      t.revenue += i.line_total_pence;
      t.qty += lineQty(i.sale_mode, i.length_m, i.quantity);
      prod.set(key, t);
    }
  }
  const sorted = (m: Map<string, Slice>) => [...m.values()].sort((a, b) => b.value - a.value);
  const tops = [...prod.values()];

  const now = Date.now();
  const unpaid: UnpaidInvoice[] = (unpaidRes.data ?? []).map((o) => {
    const addr = (o.billing_address ?? o.shipping_address) as { full_name?: string; company?: string } | null;
    return {
      id: o.id,
      number: o.number,
      name: addr?.company || addr?.full_name || o.email,
      total_pence: o.total_pence,
      created_at: o.created_at,
      invoice_due_at: o.invoice_due_at,
      overdue: !!o.invoice_due_at && new Date(o.invoice_due_at).getTime() < now,
    };
  });

  return {
    settings,
    ledger,
    previous,
    unit,
    buckets: [...map.values()],
    byCategory: sorted(cat),
    byMethod: sorted(method),
    byChannel: sorted(channel),
    topByRevenue: [...tops].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    topByQty: [...tops].sort((a, b) => b.qty - a.qty).slice(0, 8),
    invoicedUnpaid: { count: invoicedRes.data?.length ?? 0, total: (invoicedRes.data ?? []).reduce((a, o) => a + o.total_pence, 0) },
    unpaid,
    expenses: expenses as ExpenseRow[],
  };
}
