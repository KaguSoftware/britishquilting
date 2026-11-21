"use client";

import { useEffect, useRef, useState } from "react";
import { getFinancePeriod } from "@/lib/actions/admin/finance";
import type { FinanceData } from "@/lib/data/finance";
import { isCurrentOrLater, shiftPeriod, STEPPABLE, type Period, type PeriodKey } from "@/lib/finance/calc";
import { formatPence, cn } from "@/lib/utils";
import { IconDocument } from "@/components/icons";
import { btn, Card } from "@/components/admin/ui";
import { PeriodPicker } from "./period-picker";
import { LedgerTable } from "./ledger";
import { RevenueProfitChart, SplitBar, BarList, TopProducts } from "./charts";
import { UnpaidInvoices } from "./unpaid-invoices";
import { ExpensesBook } from "./expenses-book";
import { FeeSettingsForm } from "./fee-settings";

type State = { data: FinanceData; period: Period; prev: Period };

const QUICK_KEYS: Exclude<PeriodKey, "custom">[] = ["month", "last_month", "quarter", "year", "tax_year"];

/**
 * Owns the selected period client-side. The 5 quick-pick tabs (everything but a custom date
 * range) are prefetched shortly after mount and cached in memory, so switching between them
 * is instant, no server round-trip, instead of a full page navigation each time.
 */
type QuickKey = Exclude<PeriodKey, "custom">;
/** Cache key: the kind of period plus the day it was stepped to ("" for the current one). */
const slot = (key: PeriodKey, at?: string | null) => `${key}:${at ?? ""}`;

export function FinanceDashboard({ initial, initialKey, initialAt }: { initial: State; initialKey: PeriodKey; initialAt?: string | null }) {
  const [state, setState] = useState<State>(initial);
  const cache = useRef(new Map<string, State>([[slot(initialKey, initialAt), initial]]));
  const [loadingKey, setLoadingKey] = useState<PeriodKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const key of QUICK_KEYS) {
        if (cancelled || cache.current.has(slot(key))) continue;
        try {
          const result = await getFinancePeriod(key);
          if (!cancelled) cache.current.set(slot(key), result);
        } catch {
          // A quiet miss just means that tab falls back to a normal fetch on click.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const show = (key: QuickKey, at?: string | null) => {
    window.history.replaceState(null, "", `/admin/finance?p=${key}${at ? `&at=${at}` : ""}`);
    const cached = cache.current.get(slot(key, at));
    if (cached) {
      setState(cached);
      prefetchBefore(cached.period);
      return;
    }
    setLoadingKey(key);
    getFinancePeriod(key, at)
      .then((result) => {
        cache.current.set(slot(key, at), result);
        setState(result);
        prefetchBefore(result.period);
      })
      .finally(() => setLoadingKey(null));
  };

  // Fetch the period before quietly, so stepping back with the arrow is instant too.
  const prefetchBefore = (p: Period) => {
    if (!STEPPABLE.includes(p.key)) return;
    const back = shiftPeriod(p, -1);
    const k = slot(back.key, back.anchor);
    if (cache.current.has(k)) return;
    getFinancePeriod(back.key as QuickKey, back.anchor)
      .then((r) => cache.current.set(k, r))
      .catch(() => {});
  };

  const selectQuick = (key: QuickKey) => show(key);
  const step = (dir: -1 | 1) => {
    const next = shiftPeriod(state.period, dir);
    show(next.key as QuickKey, next.anchor);
  };
  const pickQuarter = (year: number, q: number) => show("quarter", `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`);

  const { data, period, prev } = state;
  const range = `from=${period.fromDay}&to=${period.toDay}`;
  const pending = loadingKey !== null;

  return (
    <>
      <PeriodPicker
        current={loadingKey ?? period.key}
        label={period.label}
        previousLabel={prev.label}
        from={period.fromDay}
        to={period.toDay}
        onQuickSelect={selectQuick}
        quickPending={pending}
        onStep={STEPPABLE.includes(period.key) ? step : undefined}
        canStepForward={!isCurrentOrLater(period, new Date())}
        onPickQuarter={period.key === "quarter" ? pickQuarter : undefined}
      />

      <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-40")}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-6">
            <LedgerTable ledger={data.ledger} previous={data.previous} previousLabel={prev.label} />
            {data.invoicedUnpaid.count > 0 && (
              <p className="border-l-2 border-gold-500 pl-3 text-sm text-ink-soft">
                Also invoiced in this period but not paid yet: {formatPence(data.invoicedUnpaid.total)} on {data.invoicedUnpaid.count}{" "}
                {data.invoicedUnpaid.count === 1 ? "invoice" : "invoices"}. They join the ledger on the day they are marked paid.
              </p>
            )}
          </div>
          <div className="space-y-6">
            <Card title={<><span className="mr-2 text-gold-600">2.</span>Owed to you</>} description="Invoices not paid yet">
              <UnpaidInvoices invoices={data.unpaid} />
            </Card>
            <Card title={<><span className="mr-2 text-gold-600">3.</span>VAT for this period</>}>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">VAT on sales</dt>
                  <dd className="tabular-nums">{formatPence(data.ledger.vat)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">VAT on purchases</dt>
                  <dd className="tabular-nums">{"−"}{formatPence(data.ledger.expensesVat)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-ink/15 pt-2 font-medium">
                  <dt>{data.ledger.vat - data.ledger.expensesVat >= 0 ? "Due to HMRC" : "HMRC owes you"}</dt>
                  <dd className="font-display text-[1.3rem] tabular-nums text-aubergine-900">{formatPence(Math.abs(data.ledger.vat - data.ledger.expensesVat))}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-stone-500">A guide for your return. Check with your accountant before you file.</p>
            </Card>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 border-b border-ink/15 pb-3 font-display text-[1.6rem] text-aubergine-900">
            <span className="mr-2 text-gold-600">4.</span>How it went
          </h2>
          <div className="grid gap-6">
            <Card title="Revenue and profit">
              <RevenueProfitChart buckets={data.buckets} unit={data.unit} />
            </Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Card title="By category">
                <BarList rows={data.byCategory} />
              </Card>
              <Card title="By payment">
                <SplitBar slices={data.byMethod} />
              </Card>
            </div>
            <Card title="Best sellers">
              <TopProducts byRevenue={data.topByRevenue} byQty={data.topByQty} />
            </Card>
          </div>
        </section>

        <section className="mt-10" id="expenses">
          <h2 className="mb-4 border-b border-ink/15 pb-3 font-display text-[1.6rem] text-aubergine-900">
            <span className="mr-2 text-gold-600">5.</span>Expenses book
          </h2>
          <ExpensesBook expenses={data.expenses} vatRate={data.settings.vat_rate} />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card title={<><span className="mr-2 text-gold-600">6.</span>Download for your accountant</>} description={`Spreadsheets for ${period.label}`}>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <a className={btn("secondary")} href={`/admin/finance/export/orders?${range}`}>
                <IconDocument className="size-4" /> Orders
              </a>
              <a className={btn("secondary")} href={`/admin/finance/export/expenses?${range}`}>
                <IconDocument className="size-4" /> Expenses
              </a>
              <a className={btn("secondary")} href={`/admin/finance/export/vat?${range}`}>
                <IconDocument className="size-4" /> VAT summary
              </a>
            </div>
          </Card>
          <Card title={<><span className="mr-2 text-gold-600">7.</span>Fee rates and VAT</>} description="What Stripe and PayPal charge you, and the VAT rate on new orders">
            <FeeSettingsForm settings={data.settings} />
          </Card>
        </section>
      </div>
    </>
  );
}
