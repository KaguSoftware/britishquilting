import Link from "next/link";
import { IconUsers } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const { db } = await staffDb();
  let query = db.from("profiles").select("id, email, full_name, company_name, role, trade_status, created_at").order("created_at", { ascending: false }).limit(1000);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,company_name.ilike.%${q}%`);
  const [{ data: people }, { data: orders }] = await Promise.all([
    query,
    db.from("orders").select("user_id, total_pence, status, created_at").not("user_id", "is", null).not("status", "in", "(pending,cancelled,refunded)"),
  ]);

  const stats = new Map<string, { count: number; total: number; last: string }>();
  for (const o of orders ?? []) {
    const s = stats.get(o.user_id) ?? { count: 0, total: 0, last: o.created_at };
    s.count++;
    s.total += o.total_pence;
    if (o.created_at > s.last) s.last = o.created_at;
    stats.set(o.user_id, s);
  }
  const rows = (people ?? []).map((p) => ({ ...p, ...(stats.get(p.id) ?? { count: 0, total: 0, last: null as string | null }) }));
  if (sp.sort === "spent") rows.sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader title="Customers" description={`${rows.length} account${rows.length === 1 ? "" : "s"}. Guests who checked out without an account appear on their orders only.`} />
      <form className="mb-5 flex flex-wrap gap-2" action="/admin/customers">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or company" className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm" />
        <select name="sort" defaultValue={sp.sort ?? ""} className="h-12 rounded-[3px] border border-ink/15 bg-white px-2 text-sm lg:h-10">
          <option value="">Newest first</option>
          <option value="spent">Spent the most</option>
        </select>
        <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<IconUsers />} title={q ? "No one matches that" : "No customers yet"} />
      ) : (
        <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          <li className="hidden grid-cols-[1.6fr_1fr_0.6fr_0.8fr] gap-4 border-b border-ink/15 px-5 py-3 text-xs text-stone-500 md:grid">
            <span>Customer</span>
            <span>Joined</span>
            <span className="text-right">Orders</span>
            <span className="text-right">Spent</span>
          </li>
          {rows.map((c) => (
            <li key={c.id} className="border-b border-ink/10 last:border-0">
              <Link href={`/admin/customers/${c.id}`} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-cream-100 md:grid-cols-[1.6fr_1fr_0.6fr_0.8fr] md:px-5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.full_name || c.email}
                    {c.trade_status === "approved" && <Badge tone="gold" className="ml-2 align-middle">Trade</Badge>}
                    {(c.role === "staff" || c.role === "owner") && <Badge tone="aubergine" className="ml-2 align-middle">Staff</Badge>}
                  </span>
                  <span className="block truncate text-xs text-stone-500">{[c.company_name, c.email].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="hidden text-sm text-ink-soft md:block">{formatDate(c.created_at)}</span>
                <span className="hidden text-right text-sm tabular-nums md:block">{c.count}</span>
                <span className="text-right text-sm tabular-nums">
                  {formatPence(c.total)}
                  <span className="block text-xs text-stone-500 md:hidden">
                    {c.count} order{c.count === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
