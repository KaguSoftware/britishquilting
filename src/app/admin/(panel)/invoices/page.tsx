import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconDocument, IconDownload, IconPhone, IconPlus, IconPrint } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { manualInvoiceNo, telHref, type BillTo } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { ListFrame, ListHead, ListRow } from "@/components/admin/list-row";
import { Menu } from "@/components/ui/menu";
import { formatDate, type Address } from "@/components/admin/format";
import { OrderSearch } from "@/components/admin/orders/order-search";

export const metadata = { title: "Invoices" };

const PAGE_SIZE = 50;

const VIEWS = [
  { key: "all", label: "All invoices" },
  { key: "manual", label: "Written by hand" },
  { key: "orders", label: "From shop orders" },
] as const;

const TABS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
] as const;

type View = (typeof VIEWS)[number]["key"];
type SP = Promise<{ view?: string; tab?: string; q?: string; page?: string }>;

/** One row in either invoice list, already worked out. */
type Row = {
  id: string;
  label: string;
  href: string;
  pdf: string;
  date: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone: string | null;
  total: number;
  payment: ReactNode;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function payment({ paidAt, due, closed }: { paidAt: string | null; due: string | null; closed?: string | null }) {
  if (closed) return <Badge tone="red">{closed === "refunded" ? "Refunded" : "Cancelled"}</Badge>;
  if (paidAt) return <Badge tone="green">Paid {formatDate(paidAt)}</Badge>;
  if (due && due.slice(0, 10) < today()) return <Badge tone="red">Overdue</Badge>;
  return <Badge tone="gold">{due ? `Due ${formatDate(due)}` : "Unpaid"}</Badge>;
}

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "all";
  const tabKey = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "all";
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const { db } = await staffDb();

  const href = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = {
      view: view === "all" ? undefined : view,
      tab: tabKey === "all" ? undefined : tabKey,
      q: sp.q,
      ...params,
    };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/admin/invoices${u.size ? `?${u}` : ""}`;
  };

  let rows: Row[] = [];
  let totalCount = 0;

  if (view === "all") {
    // Hand-written and shop order invoices in one list, newest first (the admin_invoices view).
    let rowsQuery = db
      .from("admin_invoices")
      .select("kind, id, label, number, issued, name, company, email, phone, total_pence, paid_at, due_at, closed")
      .order("issued", { ascending: false })
      .order("number", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    let countQuery = db.from("admin_invoices").select("id", { count: "exact", head: true });
    if (tabKey === "unpaid") {
      rowsQuery = rowsQuery.is("paid_at", null).is("closed", null);
      countQuery = countQuery.is("paid_at", null).is("closed", null);
    } else if (tabKey === "paid") {
      rowsQuery = rowsQuery.not("paid_at", "is", null);
      countQuery = countQuery.not("paid_at", "is", null);
    }
    if (q) {
      const n = q.replace(/^(#|inv-?m?)/i, "");
      const filter = /^\d+$/.test(n) ? `number.eq.${n}` : `name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`;
      rowsQuery = rowsQuery.or(filter);
      countQuery = countQuery.or(filter);
    }
    const [{ data }, { count }] = await Promise.all([rowsQuery, countQuery]);
    totalCount = count ?? 0;
    rows = (data ?? []).map((i) => ({
      id: `${i.kind}-${i.id}`,
      label: i.label,
      href: i.kind === "manual" ? `/admin/invoices/${i.id}` : `/admin/orders/${i.id}`,
      pdf: i.kind === "manual" ? `/admin/invoices/${i.id}/print` : `/admin/orders/${i.id}/invoice`,
      date: formatDate(i.issued),
      name: i.name ?? i.email ?? "",
      company: i.company,
      email: i.email,
      phone: i.phone,
      total: i.total_pence,
      payment: payment({ paidAt: i.paid_at, due: i.due_at, closed: i.closed }),
    }));
  } else if (view === "manual") {
    let rowsQuery = db
      .from("invoices")
      .select("id, number, bill_to, total_pence, issued_on, due_on, paid_at, customer:manual_customers(phone)")
      .order("issued_on", { ascending: false })
      .order("number", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    let countQuery = db.from("invoices").select("id", { count: "exact", head: true });
    if (tabKey === "unpaid") {
      rowsQuery = rowsQuery.is("paid_at", null);
      countQuery = countQuery.is("paid_at", null);
    } else if (tabKey === "paid") {
      rowsQuery = rowsQuery.not("paid_at", "is", null);
      countQuery = countQuery.not("paid_at", "is", null);
    }
    if (q) {
      const n = q.replace(/^(#|inv-?m?)/i, "");
      const filter = /^\d+$/.test(n) ? `number.eq.${n}` : `bill_to->>full_name.ilike.%${q}%,bill_to->>company.ilike.%${q}%,bill_to->>email.ilike.%${q}%`;
      rowsQuery = rowsQuery.or(filter);
      countQuery = countQuery.or(filter);
    }
    const [{ data }, { count }] = await Promise.all([rowsQuery, countQuery]);
    totalCount = count ?? 0;
    rows = (data ?? []).map((i) => {
      const b = i.bill_to as BillTo;
      const live = (Array.isArray(i.customer) ? i.customer[0] : i.customer) as {
        phone: string | null;
      } | null;
      return {
        id: i.id,
        label: manualInvoiceNo(i.number),
        href: `/admin/invoices/${i.id}`,
        pdf: `/admin/invoices/${i.id}/print`,
        date: formatDate(i.issued_on),
        name: b.full_name,
        company: b.company,
        email: b.email,
        phone: live?.phone ?? b.phone,
        total: i.total_pence,
        payment: payment({ paidAt: i.paid_at, due: i.due_on }),
      };
    });
  } else {
    // Abandoned checkouts never get an invoice, so "pending" is left out everywhere.
    let rowsQuery = db
      .from("orders")
      .select("id, number, email, status, total_pence, created_at, paid_at, invoice_due_at, shipping_address, billing_address, profile:profiles(full_name, phone, company_name)")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    let countQuery = db.from("orders").select("id", { count: "exact", head: true }).neq("status", "pending");
    if (tabKey === "unpaid") {
      rowsQuery = rowsQuery.is("paid_at", null).not("status", "in", "(cancelled,refunded)");
      countQuery = countQuery.is("paid_at", null).not("status", "in", "(cancelled,refunded)");
    } else if (tabKey === "paid") {
      rowsQuery = rowsQuery.not("paid_at", "is", null);
      countQuery = countQuery.not("paid_at", "is", null);
    }
    if (q) {
      const n = q.replace(/^(#|inv-?)/i, "");
      if (/^\d+$/.test(n)) {
        rowsQuery = rowsQuery.eq("number", Number(n));
        countQuery = countQuery.eq("number", Number(n));
      } else {
        rowsQuery = rowsQuery.or(`email.ilike.%${q}%,shipping_address->>full_name.ilike.%${q}%`);
        countQuery = countQuery.or(`email.ilike.%${q}%,shipping_address->>full_name.ilike.%${q}%`);
      }
    }
    const [{ data }, { count }] = await Promise.all([rowsQuery, countQuery]);
    totalCount = count ?? 0;
    rows = (data ?? []).map((o) => {
      const ship = o.shipping_address as Address | null;
      const bill = o.billing_address as Address | null;
      const profile = (Array.isArray(o.profile) ? o.profile[0] : o.profile) as {
        full_name: string | null;
        phone: string | null;
        company_name: string | null;
      } | null;
      const closed = o.status === "cancelled" || o.status === "refunded" ? o.status : null;
      return {
        id: o.id,
        label: `INV-${o.number}`,
        href: `/admin/orders/${o.id}`,
        pdf: `/admin/orders/${o.id}/invoice`,
        date: formatDate(o.created_at),
        name: bill?.full_name ?? ship?.full_name ?? profile?.full_name ?? o.email,
        company: bill?.company ?? ship?.company ?? profile?.company_name,
        email: o.email,
        phone: ship?.phone ?? bill?.phone ?? profile?.phone ?? null,
        total: o.total_pence,
        payment: payment({ paidAt: o.paid_at, due: o.invoice_due_at, closed }),
      };
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const searchHint = view === "manual" ? "Invoice number, name or company" : view === "orders" ? "Order number, email or name" : "Invoice number, name, company or email";

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Invoices for shop orders and ones written by hand, ready to print or download as a PDF. Ring a customer straight from the list."
        actions={
          <ButtonLink href="/admin/invoices/new">
            <IconPlus className="size-4" /> New invoice
          </ButtonLink>
        }
      />

      <div className="mb-5 flex rounded-[3px] border border-ink/15 bg-cream-50 p-0.5 text-sm sm:inline-flex">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({
              view: v.key === "all" ? undefined : v.key,
              tab: undefined,
              q: undefined,
              page: undefined,
            })}
            className={cn("flex-1 whitespace-nowrap rounded-[2px] px-3 py-1.5 text-center", v.key === view ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" aria-label="Invoice status">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({
                tab: t.key === "all" ? undefined : t.key,
                page: undefined,
              })}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                t.key === tabKey ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <OrderSearch key={view} initial={sp.q ?? ""} path="/admin/invoices" placeholder={searchHint} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconDocument />}
          title={q ? "No invoices match that search" : view === "manual" && tabKey === "all" ? "No invoices written yet" : "Nothing here"}
          description={
            q
              ? "Try the number on its own, e.g. 1001, or part of the customer's name."
              : view === "manual"
                ? "Write one for a phone order, a trade account or anything sold outside the shop."
                : "Invoices appear here as soon as an order is placed."
          }
          action={
            q ? (
              <ButtonLink href={href({ q: undefined, page: undefined })} variant="secondary">
                Clear the search
              </ButtonLink>
            ) : view === "manual" ? (
              <ButtonLink href="/admin/invoices/new">
                <IconPlus className="size-4" /> New invoice
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ListFrame>
          <ListHead cols={["Invoice", "Customer", "Telephone", "Payment", "Total"]} />
          {rows.map((r) => (
            <ListRow
              key={r.id}
              href={r.href}
              refLabel={r.label}
              title={r.name}
              sub={[r.date, r.company, r.email].filter(Boolean).join(" · ")}
              aside={r.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
              badge={r.payment}
              figure={<span className="font-medium">{formatPence(r.total)}</span>}
              action={
                <ButtonLink href={`${r.pdf}?do=pdf`} target="_blank" size="sm">
                  <IconDownload className="size-4" /> PDF
                </ButtonLink>
              }
              menu={
                <Menu
                  label={`More for ${r.label}`}
                  title={`${r.label}, ${r.name}`}
                  items={[
                    { label: "Open", icon: <IconDocument />, href: r.href },
                    { label: "Print", icon: <IconPrint />, href: `${r.pdf}?do=print`, target: "_blank" },
                    { label: "Download PDF", icon: <IconDownload />, href: `${r.pdf}?do=pdf`, target: "_blank" },
                    ...(r.phone ? [{ label: `Call ${r.phone}`, icon: <IconPhone />, href: telHref(r.phone) }] : []),
                    ...(r.email ? [{ label: "Email", icon: <IconDocument />, href: `mailto:${r.email}` }] : []),
                  ]}
                />
              }
            />
          ))}
        </ListFrame>
      )}

      {rows.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm text-stone-500">
            Page {page} of {totalPages} &middot; {totalCount} invoice
            {totalCount === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <ButtonLink href={href({ page: page > 1 ? String(page - 1) : undefined })} variant="secondary" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-40")}>
              <IconChevronLeft className="size-4" /> Previous
            </ButtonLink>
            <ButtonLink
              href={href({
                page: page < totalPages ? String(page + 1) : undefined,
              })}
              variant="secondary"
              size="sm"
              className={cn(page >= totalPages && "pointer-events-none opacity-40")}
            >
              Next <IconChevronRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
