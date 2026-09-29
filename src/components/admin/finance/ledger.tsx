import Link from "next/link";
import { change, type Ledger } from "@/lib/finance/calc";
import { cn, formatPence } from "@/lib/utils";

type Row = {
  key: keyof Ledger;
  label: string;
  note?: string;
  /** shown as money going out */
  minus?: boolean;
  /** a detail line, indented and quieter */
  detail?: boolean;
  /** lower is better (costs) */
  inverse?: boolean;
  rule?: boolean;
};

const ROWS: Row[] = [
  { key: "gross", label: "Gross sales", note: "Everything customers paid, VAT, postage and all" },
  { key: "refunds", label: "Refunds", note: "Money given back in this period", minus: true, inverse: true },
  { key: "chargebacks", label: "Chargebacks", note: "Payments taken back by the customer's bank", minus: true, inverse: true },
  { key: "net", label: "Net sales", rule: true },
  { key: "vat", label: "VAT on sales", note: "What you owe HMRC, after refunds", minus: true, inverse: true },
  { key: "revenueExVat", label: "Revenue, before VAT", rule: true },
  { key: "shipping", label: "of which postage charged", detail: true },
  { key: "discounts", label: "Discounts given", detail: true, inverse: true },
  { key: "fees", label: "Payment fees", note: "Card and PayPal charges: the rate each order was actually paid at, or an estimate for older orders", minus: true, inverse: true },
  { key: "disputeFees", label: "Dispute fees", note: "Charged by the payment provider when a customer disputes a payment", minus: true, inverse: true },
  { key: "cogs", label: "Cost of fabric sold", minus: true, inverse: true },
  { key: "expensesExVat", label: "Expenses, before VAT", note: "From your expenses book", minus: true, inverse: true },
];

const showRow = (key: keyof Ledger, ledger: Ledger, previous: Ledger) => (key === "chargebacks" || key === "disputeFees" ? ledger[key] !== 0 || previous[key] !== 0 : true);

function Delta({ now, before, inverse }: { now: number; before: number; inverse?: boolean }) {
  const c = change(now, before);
  if (c == null) return <span className="text-stone-500">{now === 0 ? "" : "new"}</span>;
  if (Math.abs(c) < 0.5) return <span className="text-stone-500">level</span>;
  const good = inverse ? c < 0 : c > 0;
  return (
    <span className={good ? "text-success" : "text-danger"}>
      {c > 0 ? "up" : "down"} {Math.abs(c) >= 1000 ? ">999" : Math.round(Math.abs(c))}%
    </span>
  );
}

export function LedgerTable({ ledger, previous, previousLabel }: { ledger: Ledger; previous: Ledger; previousLabel: string }) {
  const margin = ledger.revenueExVat > 0 ? Math.round((ledger.profit / ledger.revenueExVat) * 100) : null;
  return (
    <section aria-labelledby="ledger-h" className="rounded-[3px] border border-ink/12 bg-cream-50">
      <header className="flex items-baseline justify-between gap-4 border-b border-ink/10 px-5 py-4">
        <h2 id="ledger-h" className="font-display text-[1.35rem] leading-tight text-aubergine-900">
          <span className="mr-2 text-gold-600">1.</span>The ledger
        </h2>
        <p className="text-xs text-stone-500">
          {ledger.orders} paid {ledger.orders === 1 ? "order" : "orders"}
        </p>
      </header>

      <div className="hidden grid-cols-[1fr_9rem_9rem_6rem] gap-4 border-b border-ink/10 px-5 py-2 text-xs text-stone-500 md:grid">
        <span />
        <span className="text-right">This period</span>
        <span className="text-right">{previousLabel}</span>
        <span className="text-right">Change</span>
      </div>

      <ol>
        {ROWS.filter((r) => showRow(r.key, ledger, previous)).map((r) => (
          <li
            key={r.key}
            className={cn(
              "grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 px-5 py-3 md:grid-cols-[1fr_9rem_9rem_6rem]",
              r.rule ? "border-t border-ink/25" : "border-t border-ink/8 first:border-t-0",
              r.detail && "py-2",
            )}
          >
            <div className={cn("min-w-0", r.detail && "pl-4")}>
              <p className={cn(r.detail ? "text-sm text-ink-soft" : "text-[0.95rem] text-ink", r.rule && "font-medium")}>{r.label}</p>
              {r.note && <p className="text-xs text-stone-500">{r.note}</p>}
              {r.key === "cogs" && ledger.costMissing > 0 && (
                <p className="text-xs text-danger">
                  {formatPence(ledger.costMissingSales)} of sales ({ledger.costMissing} {ledger.costMissing === 1 ? "line" : "lines"}) had no cost price, so they count as costing nothing. Profit below is overstated.{" "}
                  <Link href="/admin/products" className="underline underline-offset-2">
                    Add cost prices
                  </Link>
                </p>
              )}
            </div>
            <p className={cn("text-right tabular-nums", r.detail ? "text-sm text-ink-soft" : "text-[1.15rem] text-ink md:text-base", r.rule && "font-medium")}>
              {r.minus && ledger[r.key] !== 0 ? "−" : ""}
              {formatPence(ledger[r.key])}
            </p>
            <p className="col-span-2 text-right text-xs tabular-nums text-stone-500 md:col-span-1 md:text-sm">
              <span className="md:hidden">was </span>
              {formatPence(previous[r.key])}
              <span className="md:hidden">
                {" "}
                · <Delta now={ledger[r.key]} before={previous[r.key]} inverse={r.inverse} />
              </span>
            </p>
            <p className="hidden text-right text-sm tabular-nums md:block">
              <Delta now={ledger[r.key]} before={previous[r.key]} inverse={r.inverse} />
            </p>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t-2 border-aubergine-900 bg-cream-100/60 px-5 py-5 md:grid-cols-[1fr_9rem_9rem_6rem]">
          <div>
            <p className="font-display text-[1.6rem] leading-none text-aubergine-900">{ledger.costMissing > 0 ? "Profit, at most" : "Profit"}</p>
            <p className="mt-1 text-xs text-stone-500">{margin == null ? "Before tax on profits" : `${margin}% of revenue, before tax on profits`}</p>
          </div>
          <p className={cn("text-right font-display text-[2.1rem] leading-none tabular-nums md:text-[1.7rem]", ledger.profit < 0 ? "text-danger" : "text-aubergine-900")}>
            {ledger.profit < 0 ? "−" : ""}
            {formatPence(Math.abs(ledger.profit))}
          </p>
          <p className="col-span-2 mt-1 text-right text-xs tabular-nums text-stone-500 md:col-span-1 md:mt-0 md:text-sm">
            <span className="md:hidden">was </span>
            {formatPence(previous.profit)}
            <span className="md:hidden">
              {" "}
              · <Delta now={ledger.profit} before={previous.profit} />
            </span>
          </p>
          <p className="hidden text-right text-sm tabular-nums md:block">
            <Delta now={ledger.profit} before={previous.profit} />
          </p>
        </li>
      </ol>
    </section>
  );
}
