import { ownerDb } from "@/lib/actions/admin/guard";
import { loadFinance } from "@/lib/data/finance";
import { previousPeriod, resolvePeriod, type PeriodKey } from "@/lib/finance/calc";
import { formatPence } from "@/lib/utils";
import { IconDocument } from "@/components/icons";
import { btn, Card, PageHeader } from "@/components/admin/ui";
import { PeriodPicker } from "@/components/admin/finance/period-picker";
import { LedgerTable } from "@/components/admin/finance/ledger";
import { RevenueProfitChart, SplitBar, BarList, TopProducts } from "@/components/admin/finance/charts";
import { UnpaidInvoices } from "@/components/admin/finance/unpaid-invoices";
import { ExpensesBook } from "@/components/admin/finance/expenses-book";
import { FeeSettingsForm, VatRateForm } from "@/components/admin/finance/fee-settings";

export const metadata = { title: "Money" };

const KEYS: PeriodKey[] = ["month", "last_month", "quarter", "year", "tax_year", "custom"];

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db } = await ownerDb();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const key = (KEYS.includes(one("p") as PeriodKey) ? one("p") : "month") as PeriodKey;
  const period = resolvePeriod(key, new Date(), { from: one("from"), to: one("to") });
  const prev = previousPeriod(period);
  const data = await loadFinance(db, period, prev);
  const range = `from=${period.fromDay}&to=${period.toDay}`;

  return (
    <div>
      <PageHeader
        eyebrow="Owner only"
        title="Money"
        description="What came in, what went out and what is left. Figures are before tax on profits."
      />
      <PeriodPicker current={period.key} label={period.label} previousLabel={prev.label} from={period.fromDay} to={period.toDay} />

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
          <Card title={<><span className="mr-2 text-gold-600">2.</span>Owed to you</>} description="Trade invoices not paid yet">
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
          <div className="grid gap-6 md:grid-cols-3">
            <Card title="By category">
              <BarList rows={data.byCategory} />
            </Card>
            <Card title="By payment">
              <SplitBar slices={data.byMethod} />
            </Card>
            <Card title="Trade and retail">
              <SplitBar slices={data.byChannel} />
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
        <Card title={<><span className="mr-2 text-gold-600">7.</span>Fee rates</>} description="What Stripe and PayPal charge you">
          <FeeSettingsForm settings={data.settings} />
          <div className="mt-6 border-t border-ink/10 pt-6">
            <VatRateForm vatRate={data.settings.vat_rate} />
          </div>
        </Card>
      </section>
    </div>
  );
}
