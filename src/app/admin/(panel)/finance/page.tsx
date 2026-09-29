import { ownerDb } from "@/lib/actions/admin/guard";
import { loadFinance } from "@/lib/data/finance";
import { previousPeriod, resolvePeriod, type PeriodKey } from "@/lib/finance/calc";
import { PageHeader } from "@/components/admin/ui";
import { FinanceDashboard } from "@/components/admin/finance/dashboard";

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

  return (
    <div>
      <PageHeader
        eyebrow="Owner only"
        title="Money"
        description="What came in, what went out and what is left. Figures are before tax on profits."
      />
      <FinanceDashboard initial={{ data, period, prev }} initialKey={key} />
    </div>
  );
}
