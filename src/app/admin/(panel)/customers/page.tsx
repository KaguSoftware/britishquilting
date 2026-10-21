import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconDeliveryNote, IconDocument, IconParcel, IconPhone, IconPlus, IconUser, IconUsers } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { CUSTOMER_COLS } from "@/lib/data/invoices";
import { customerNo, parseCid, telHref, type ManualCustomer } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader, btn } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { ListFrame, ListHead, ListRow } from "@/components/admin/list-row";
import { AutoSubmitDropdown } from "@/components/ui/auto-submit";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { CustomerBook } from "@/components/admin/customers/customer-book";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 100;

const VIEWS = [
  { key: "all", label: "All customers" },
  { key: "accounts", label: "With an account" },
  { key: "guests", label: "Without an account" },
  { key: "manual", label: "Added by hand" },
] as const;
type View = (typeof VIEWS)[number]["key"];

type SP = Promise<{ q?: string; sort?: string; view?: string; add?: string; page?: string }>;

const KIND = {
  manual: { label: "Added by hand", tone: "neutral" },
  account: { label: "Website account", tone: "aubergine" },
  guest: { label: "Guest", tone: "gold" },
} as const;

/** The actions every kind of customer row offers: a Call button, then the rest under "⋯". */
function rowActions(name: string, phone: string | null, items: MenuItem[]) {
  return {
    action: phone ? (
      <a href={telHref(phone)} className={btn("secondary", "sm")} title={`Call ${name}`}>
        <IconPhone className="size-4" /> Call
      </a>
    ) : null,
    menu: <Menu label={`More for ${name}`} title={name} items={items} />,
  };
}

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "all";
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const cid = parseCid(q);
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);
  const { db } = await staffDb();

  const href = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ view: view === "all" ? undefined : view, q: sp.q, sort: sp.sort, ...params })) if (v) u.set(k, v);
    return `/admin/customers${u.size ? `?${u}` : ""}`;
  };

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
      <div className="mb-5 flex overflow-x-auto rounded-[3px] border border-ink/15 bg-cream-50 p-0.5 text-sm sm:inline-flex">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "all" ? "/admin/customers" : `/admin/customers?view=${v.key}`}
            className={cn("flex-1 shrink-0 whitespace-nowrap rounded-[2px] px-3 py-1.5 text-center", v.key === view ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}
          >
            {v.label}
          </Link>
        ))}
      </div>
    </>
  );

  const search = (placeholder: string, sort?: { value: string; label: string }[]) => (
    <form key={view} className="mb-5 flex flex-wrap gap-2" action="/admin/customers">
      {view !== "all" && <input type="hidden" name="view" value={view} />}
      <input
        name="q"
        defaultValue={sp.q}
        placeholder={placeholder}
        className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm"
      />
      {sort && (
        <AutoSubmitDropdown
          name="sort"
          size="sm"
          aria-label="Sort customers"
          sheetTitle="Sort customers"
          defaultValue={sp.sort === "spent" ? "spent" : ""}
          options={sort}
          className="h-12 min-w-44 rounded-[3px] border-ink/15 bg-white text-sm lg:h-10"
        />
      )}
      <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
    </form>
  );

  const pager = (total: number, noun: string) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages <= 1) return null;
    return (
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-sm text-stone-500">
          Page {page} of {pages} &middot; {total} {noun}
        </span>
        <div className="flex gap-2">
          <ButtonLink href={href({ page: page > 1 ? String(page - 1) : undefined })} variant="secondary" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-40")}>
            <IconChevronLeft className="size-4" /> Previous
          </ButtonLink>
          <ButtonLink href={href({ page: String(page + 1) })} variant="secondary" size="sm" className={cn(page >= pages && "pointer-events-none opacity-40")}>
            Next <IconChevronRight className="size-4" />
          </ButtonLink>
        </div>
      </div>
    );
  };

  /* ───────────────────────── all customers, every kind */
  if (view === "all") {
    let query = db
      .from("admin_customers")
      .select("kind, ref_id, cid, name, company, email, phone, role, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (q) query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%${cid != null ? `,cid.eq.${cid}` : ""}`);
    const { data, count } = await query;
    type Row = { kind: keyof typeof KIND; ref_id: string | null; cid: number; name: string; company: string | null; email: string | null; phone: string | null; role: string | null; created_at: string };
    const rows = (data ?? []) as Row[];
    const total = count ?? rows.length;

    return (
      <div>
        {header(`Everyone in one list, newest first: ${total} customer${total === 1 ? "" : "s"} with an account, without one, or added by hand.`)}
        {search("CID, name, company, email or phone")}
        {rows.length === 0 ? (
          <EmptyState icon={<IconUsers />} title={q ? "No one matches that" : "No customers yet"} />
        ) : (
          <ListFrame>
            <ListHead cols={["CID", "Customer", "Telephone", "Type", "Since"]} />
            {rows.map((r) => {
              const open =
                r.kind === "manual" ? `/admin/customers/manual/${r.ref_id}` : r.kind === "account" ? `/admin/customers/${r.ref_id}` : `/admin/orders?tab=all&q=${encodeURIComponent(r.email ?? "")}`;
              const items: MenuItem[] =
                r.kind === "manual"
                  ? [
                      { label: "Invoices and delivery notes", icon: <IconDocument />, href: open },
                      { label: "New invoice", icon: <IconDocument />, href: `/admin/invoices/new?customer=${r.ref_id}` },
                      { label: "New delivery note", icon: <IconDeliveryNote />, href: `/admin/delivery-notes/new?customer=${r.ref_id}` },
                    ]
                  : r.kind === "account"
                    ? [
                        { label: "Customer details", icon: <IconUser />, href: open },
                        { label: "Their orders", icon: <IconParcel />, href: `/admin/orders?tab=all&q=${encodeURIComponent(r.email ?? "")}` },
                      ]
                    : [{ label: "Their orders", icon: <IconParcel />, href: open }];
              if (r.email) items.push({ label: "Email", icon: <IconUser />, href: `mailto:${r.email}` });
              const kind = KIND[r.kind];
              return (
                <ListRow
                  key={`${r.kind}-${r.cid}`}
                  href={open}
                  refLabel={customerNo(r.cid)}
                  title={r.name}
                  sub={[r.company, r.name !== r.email ? r.email : null].filter(Boolean).join(" · ")}
                  aside={r.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
                  badge={
                    <Badge tone={kind.tone}>
                      {r.role === "owner" || r.role === "staff" ? "Staff" : kind.label}
                    </Badge>
                  }
                  figure={<span className="text-ink-soft">{formatDate(r.created_at)}</span>}
                  {...rowActions(r.name, r.phone, items)}
                />
              );
            })}
          </ListFrame>
        )}
        {pager(total, "customers")}
      </div>
    );
  }

  /* ───────────────────────── added by hand */
  if (view === "manual") {
    let query = db
      .from("manual_customers")
      .select(CUSTOMER_COLS, { count: "exact" })
      .order("full_name")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (q) query = query.or(`full_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%${cid != null ? `,number.eq.${cid}` : ""}`);
    const { data, count } = await query;
    const customers = (data ?? []) as ManualCustomer[];
    const total = count ?? customers.length;
    return (
      <div>
        {header(`${total} customer${total === 1 ? "" : "s"} added by hand, for phone orders, trade accounts and anyone without a website account.`)}
        {search("CID, name, company, email or phone")}
        <CustomerBook customers={customers} searching={!!q} adding={sp.add === "1"} />
        {pager(total, "customers")}
      </div>
    );
  }

  /* ───────────────────────── guests */
  if (view === "guests") {
    // Guests have no customer record: group their orders by email. Pending orders are abandoned
    // checkouts, so they don't make someone a customer. Emails that now belong to an account are left
    // out, as those people are listed under "With an account".
    const [{ data: orders }, { data: accounts }, { data: guestIds }] = await Promise.all([
      db.from("orders").select("email, status, total_pence, created_at, shipping_address, billing_address").is("user_id", null).neq("status", "pending").order("created_at", { ascending: false }),
      db.from("profiles").select("email"),
      db.from("guest_customers").select("email, cid"),
    ]);
    const taken = new Set((accounts ?? []).map((a) => String(a.email).toLowerCase()));
    const cidOf = new Map((guestIds ?? []).map((g) => [String(g.email).toLowerCase(), g.cid as number]));
    type Addr = { fullName?: string; full_name?: string; phone?: string | null; company?: string | null } | null;
    const byEmail = new Map<string, { email: string; name: string | null; company: string | null; phone: string | null; count: number; total: number; last: string }>();
    for (const o of orders ?? []) {
      const email = String(o.email).toLowerCase();
      if (taken.has(email)) continue;
      const addr = (o.shipping_address ?? o.billing_address) as Addr;
      const g = byEmail.get(email) ?? { email, name: null, company: null, phone: null, count: 0, total: 0, last: o.created_at };
      // Orders arrive newest first, so the first name and phone seen are the most recent.
      g.name ??= addr?.fullName || addr?.full_name || null;
      g.company ??= addr?.company || null;
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
      rows = rows.filter((g) => [g.email, g.name, g.phone].some((v) => v?.toLowerCase().includes(needle)) || (cid != null && cidOf.get(g.email) === cid));
    }
    if (sp.sort === "spent") rows.sort((a, b) => b.total - a.total);
    const total = rows.length;
    rows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
      <div>
        {header(`${total} guest${total === 1 ? "" : "s"} who checked out without an account, grouped by email. If they later sign up with the same email, their orders and CID move to their account.`)}
        {search("CID, name, email or phone", [
          { value: "", label: "Most recent order" },
          { value: "spent", label: "Spent the most" },
        ])}
        {rows.length === 0 ? (
          <EmptyState icon={<IconUsers />} title={q ? "No one matches that" : "No guest orders yet"} />
        ) : (
          <ListFrame>
            <ListHead cols={["CID", "Customer", "Telephone", "Last order", "Spent"]} />
            {rows.map((g) => {
              const orders = `/admin/orders?tab=all&q=${encodeURIComponent(g.email)}`;
              const id = cidOf.get(g.email);
              return (
                <ListRow
                  key={g.email}
                  href={orders}
                  refLabel={id ? customerNo(id) : "–"}
                  title={g.name || g.email}
                  sub={[g.company, g.name ? g.email : null].filter(Boolean).join(" · ")}
                  aside={g.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
                  badge={
                    <span className="text-sm text-ink-soft">
                      {formatDate(g.last)} &middot; {g.count} order{g.count === 1 ? "" : "s"}
                    </span>
                  }
                  figure={formatPence(g.total)}
                  {...rowActions(g.name || g.email, g.phone, [
                    { label: "Their orders", icon: <IconParcel />, href: orders },
                    { label: "Email", icon: <IconUser />, href: `mailto:${g.email}` },
                  ])}
                />
              );
            })}
          </ListFrame>
        )}
        {pager(total, "guests")}
      </div>
    );
  }

  /* ───────────────────────── with an account */
  let query = db.from("profiles").select("id, cid, email, full_name, phone, company_name, role, created_at").order("created_at", { ascending: false }).limit(1000);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%${cid != null ? `,cid.eq.${cid}` : ""}`);
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
  let rows = (people ?? []).map((p) => ({ ...p, ...(stats.get(p.id) ?? { count: 0, total: 0, last: null as string | null }) }));
  if (sp.sort === "spent") rows.sort((a, b) => b.total - a.total);
  const total = rows.length;
  rows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {header(`${total} account${total === 1 ? "" : "s"}. Guests who checked out without one are under "Without an account".`)}
      {search("CID, name, email, company or phone", [
        { value: "", label: "Newest first" },
        { value: "spent", label: "Spent the most" },
      ])}
      {rows.length === 0 ? (
        <EmptyState icon={<IconUsers />} title={q ? "No one matches that" : "No customers yet"} />
      ) : (
        <ListFrame>
          <ListHead cols={["CID", "Customer", "Telephone", "Joined", "Spent"]} />
          {rows.map((c) => {
            const name = c.full_name || c.email;
            return (
              <ListRow
                key={c.id}
                href={`/admin/customers/${c.id}`}
                refLabel={c.cid ? customerNo(c.cid) : "–"}
                title={name}
                sub={[c.company_name, c.full_name ? c.email : null].filter(Boolean).join(" · ")}
                aside={c.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
                badge={
                  <span className="flex items-center gap-2 text-sm text-ink-soft">
                    {formatDate(c.created_at)}
                    {(c.role === "staff" || c.role === "owner") && <Badge tone="aubergine">Staff</Badge>}
                  </span>
                }
                figure={
                  <>
                    {formatPence(c.total)}
                    <span className="block text-xs text-stone-500">
                      {c.count} order{c.count === 1 ? "" : "s"}
                    </span>
                  </>
                }
                {...rowActions(name, c.phone, [
                  { label: "Customer details", icon: <IconUser />, href: `/admin/customers/${c.id}` },
                  { label: "Their orders", icon: <IconParcel />, href: `/admin/orders?tab=all&q=${encodeURIComponent(c.email)}` },
                  { label: "Email", icon: <IconUser />, href: `mailto:${c.email}` },
                ])}
              />
            );
          })}
        </ListFrame>
      )}
      {pager(total, "accounts")}
    </div>
  );
}
