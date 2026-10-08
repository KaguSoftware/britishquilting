import { ownerDb } from "@/lib/actions/admin/guard";
import { loadChargebacks, loadExpenses, loadOrders, loadRefunds, loadSettings } from "@/lib/data/finance";
import { computeLedger, londonDay, orderCogs, orderFee, resolvePeriod, ymdToIso } from "@/lib/finance/calc";
import { expenseCategoryLabel } from "@/lib/finance/categories";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Guard against spreadsheet formula injection and escape quotes
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
const money = (p: number) => (p / 100).toFixed(2);
const day = (iso: string) => ymdToIso(londonDay(new Date(iso)));
const METHOD: Record<string, string> = { stripe: "Card (Stripe)", paypal: "PayPal", invoice: "Invoice" };

function csv(rows: unknown[][], name: string) {
  return new Response("﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const { db } = await ownerDb();
  const url = new URL(request.url);
  const period = resolvePeriod("custom", new Date(), { from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  const tag = `${period.fromDay}-to-${period.toDay}`;

  if (kind === "orders") {
    const [settings, orders, refunds] = await Promise.all([loadSettings(db), loadOrders(db, period.start, period.end), loadRefunds(db, period.start, period.end)]);
    const { data: refundOrders } = refunds.length
      ? await db.from("orders").select("id, number").in("id", [...new Set(refunds.map((r) => r.order_id))])
      : { data: [] as { id: string; number: number }[] };
    const numbers = new Map((refundOrders ?? []).map((o) => [o.id, o.number]));
    const rows: unknown[][] = [
      ["Type", "Date", "Order", "Paid by", "Gross", "VAT", "Net of VAT", "Postage", "Discount", "Fee", "Cost of goods", "Lines without cost (cost of goods understated)"],
    ];
    for (const o of orders) {
      const c = orderCogs(o.order_items ?? [], o.vat_rate ?? 20);
      rows.push([
        "Sale",
        day(o.paid_at),
        o.number,
        METHOD[o.payment_provider ?? ""] ?? o.payment_provider ?? "",
        money(o.total_pence),
        money(o.vat_included_pence),
        money(o.total_pence - o.vat_included_pence),
        money(o.shipping_pence),
        money(o.discount_pence),
        money(orderFee(o, settings)),
        money(c.cogs),
        c.missing,
      ]);
    }
    for (const r of refunds) {
      rows.push(["Refund", day(r.created_at), numbers.get(r.order_id) ?? "", "", money(-r.amount_pence), money(-r.vat_pence), money(-(r.amount_pence - r.vat_pence)), "", "", "", "", ""]);
    }
    return csv(rows, `british-quilting-orders-${tag}.csv`);
  }

  if (kind === "expenses") {
    const expenses = await loadExpenses(db, period.fromDay, period.toDay);
    const rows: unknown[][] = [["Date", "Supplier", "Category", "Total paid", "VAT", "Net of VAT", "Note", "Receipt attached"]];
    for (const e of [...expenses].reverse()) {
      rows.push([e.spent_on, e.supplier, expenseCategoryLabel(e.category), money(e.amount_pence), money(e.vat_pence), money(e.amount_pence - e.vat_pence), e.note ?? "", e.receipt_path ? "Yes" : "No"]);
    }
    return csv(rows, `british-quilting-expenses-${tag}.csv`);
  }

  if (kind === "vat") {
    const [settings, orders, refunds, expenses, chargebacks] = await Promise.all([
      loadSettings(db),
      loadOrders(db, period.start, period.end),
      loadRefunds(db, period.start, period.end),
      loadExpenses(db, period.fromDay, period.toDay),
      loadChargebacks(db, period.start, period.end),
    ]);
    const l = computeLedger(orders.map((o) => ({ ...o, items: o.order_items ?? [] })), refunds, expenses, settings, chargebacks);
    const salesVat = orders.reduce((a, o) => a + o.vat_included_pence, 0);
    const refundVat = refunds.reduce((a, r) => a + r.vat_pence, 0);
    const due = l.vat - l.expensesVat;
    const rows: unknown[][] = [
      ["VAT summary", `${period.fromDay} to ${period.toDay}`],
      [],
      ["Line", "Amount"],
      ["VAT on sales", money(salesVat)],
      ["Less VAT on refunds", money(-refundVat)],
      ["VAT on sales, net of refunds", money(l.vat)],
      ["VAT on purchases (from expenses)", money(l.expensesVat)],
      [due >= 0 ? "Net VAT due to HMRC" : "Net VAT to reclaim from HMRC", money(Math.abs(due))],
      [],
      ["Sales before VAT (net of refunds)", money(l.revenueExVat)],
      ["Purchases before VAT", money(l.expensesExVat)],
      [],
      ["A guide only. Please check with your accountant before filing."],
    ];
    return csv(rows, `british-quilting-vat-${tag}.csv`);
  }

  return new Response("Not found", { status: 404 });
}
