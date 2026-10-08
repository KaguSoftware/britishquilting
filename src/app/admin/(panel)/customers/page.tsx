import Link from "next/link";
import { IconPlus, IconUsers } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { CUSTOMER_COLS } from "@/lib/data/invoices";
import type { ManualCustomer } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { Dropdown } from "@/components/ui/dropdown";
import { CustomerBook } from "@/components/admin/customers/customer-book";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; view?: string; add?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const manual = sp.view === "manual";
  const guests = sp.view === "guests";
  const { db } = await staffDb();

  const header = (description: string) => (
    <>
      <PageHeader
        title="Customers"
        description={description}
        actions={
          <ButtonLink href="/admin/customers?view=manual&add=1">
            <IconPlus className="size-4" /> Add customer
          </ButtonLink>
        }
      />
      <div className="mb-5 flex rounded-[3px] border border-ink/15 bg-cream-50 p-0.5 text-sm sm:inline-flex">
        {[
          { href: "/admin/customers", label: "With an account", on: !manual && !guests },
          { href: "/admin/customers?view=guests", label: "Without an account", on: guests },
          { href: "/admin/customers?view=manual", label: "Added by hand", on: manual },
        ].map((v) => (
          <Link key={v.href} href={v.href} className={cn("flex-1 rounded-[2px] px-3 py-1.5 text-center", v.on ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}>
            {v.label}
          </Link>
        ))}
      </div>
    </>
  );

  if (manual) {
    let query = db.from("manual_customers").select(CUSTOMER_COLS).order("full_name").limit(1000);
    if (q) query = query.or(`full_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const customers = ((await query).data ?? []) as ManualCustomer[];
    return (
      <div>
        {header(`${customers.length} customer${customers.length === 1 ? "" : "s"} added by hand, for phone orders, trade accounts and anyone without a website account.`)}
        <form className="mb-5 flex flex-wrap gap-2" action="/admin/customers">
          <input type="hidden" name="view" value="manual" />
          <input name="q" defaultValue={sp.q} placeholder="Name, company, email or phone" className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm" />
          <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
        </form>
        <CustomerBook customers={customers} searching={!!q} adding={sp.add === "1"} />
      </div>
    );
  }

  if (guests) {
    // Guests have no customer record: group their orders by email. Pending orders are abandoned
    // checkouts, so they don't make someone a customer. Emails that now belong to an account are left
    // out, as those people are listed under "With an account".
    const [{ data: orders }, { data: accounts }] = await Promise.all([
      db.from("orders").select("email, status, total_pence, created_at, shipping_address, billing_address").is("user_id", null).neq("status", "pending").order("created_at", { ascending: false }),
      db.from("profiles").select("email"),
    ]);
    const taken = new Set((accounts ?? []).map((a) => String(a.email).toLowerCase()));
    type Addr = { fullName?: string; full_name?: string; phone?: string | null } | null;
    const byEmail = new Map<string, { email: string; name: string | null; phone: string | null; count: number; total: number; last: string }>();
    for (const o of orders ?? []) {
      const email = String(o.email).toLowerCase();
      if (taken.has(email)) continue;
      const addr = (o.shipping_address ?? o.billing_address) as Addr;
      const g = byEmail.get(email) ?? { email, name: null, phone: null, count: 0, total: 0, last: o.created_at };
      // Orders arrive newest first, so the first name and phone seen are the most recent.
      g.name ??= addr?.fullName || addr?.full_name || null;
      g.phone ??= addr?.phone || null;
      if (o.status !== "cancelled" && o.status !== "refunded") {
        g.count++;
        g.total += o.total_pence;
      }
      byEmail.set(email, g);
    }
    let rows = [...byEmail.values()];
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((g) => [g.email, g.name, g.phone].some((v) => v?.toLowerCase().includes(needle)));
    }
    if (sp.sort === "spent") rows.sort((a, b) => b.total - a.total);

    return (
      <div>
        {header(`${rows.length} guest${rows.length === 1 ? "" : "s"} who checked out without an account, grouped by email. If they later sign up with the same email, their orders move to their account.`)}
        <form className="mb-5 flex flex-wrap gap-2" action="/admin/customers">
          <input type="hidden" name="view" value="guests" />
          <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm" />
          <Dropdown
            name="sort"
            size="sm"
            aria-label="Sort customers"
            sheetTitle="Sort customers"
            defaultValue={sp.sort === "spent" ? "spent" : ""}
            options={[
              { value: "", label: "Most recent order" },
              { value: "spent", label: "Spent the most" },
            ]}
            className="h-12 min-w-44 rounded-[3px] border-ink/15 bg-white text-sm lg:h-10"
          />
          <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
        </form>

        {rows.length === 0 ? (
          <EmptyState icon={<IconUsers />} title={q ? "No one matches that" : "No guest orders yet"} />
        ) : (
          <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
            <li className="hidden grid-cols-[1.6fr_1fr_0.6fr_0.8fr] gap-4 border-b border-ink/15 px-5 py-3 text-xs text-stone-500 md:grid">
              <span>Customer</span>
              <span>Last order</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Spent</span>
            </li>
            {rows.map((g) => (
              <li key={g.email} className="border-b border-ink/10 last:border-0">
                <Link
                  href={`/admin/orders?tab=all&q=${encodeURIComponent(g.email)}`}
                  className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-cream-100 md:grid-cols-[1.6fr_1fr_0.6fr_0.8fr] md:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.name || g.email}</span>
                    <span className="block truncate text-xs text-stone-500">{[g.name ? g.email : null, g.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="hidden text-sm text-ink-soft md:block">{formatDate(g.last)}</span>
                  <span className="hidden text-right text-sm tabular-nums md:block">{g.count}</span>
                  <span className="text-right text-sm tabular-nums">
                    {formatPence(g.total)}
                    <span className="block text-xs text-stone-500 md:hidden">
                      {g.count} order{g.count === 1 ? "" : "s"}
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

  let query = db.from("profiles").select("id, email, full_name, company_name, role, created_at").order("created_at", { ascending: false }).limit(1000);
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
      {header(`${rows.length} account${rows.length === 1 ? "" : "s"}. Guests who checked out without one are under "Without an account".`)}
      <form className="mb-5 flex flex-wrap gap-2" action="/admin/customers">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or company" className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm" />
        <Dropdown
          name="sort"
          size="sm"
          aria-label="Sort customers"
          sheetTitle="Sort customers"
          defaultValue={sp.sort === "spent" ? "spent" : ""}
          options={[
            { value: "", label: "Newest first" },
            { value: "spent", label: "Spent the most" },
          ]}
          className="h-12 min-w-44 rounded-[3px] border-ink/15 bg-white text-sm lg:h-10"
        />
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
