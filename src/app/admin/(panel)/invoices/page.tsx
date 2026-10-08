import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconDocument, IconPhone, IconPlus } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { manualInvoiceNo, telHref, type BillTo } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader, btn } from "@/components/admin/ui";
import { formatDate, type Address } from "@/components/admin/format";
import { OrderSearch } from "@/components/admin/orders/order-search";

export const metadata = { title: "Invoices" };

const PAGE_SIZE = 50;

const VIEWS = [
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
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "manual";
  const tabKey = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "all";
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const { db } = await staffDb();

  const href = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = {
      view: view === "manual" ? undefined : view,
      tab: tabKey === "all" ? undefined : tabKey,
      q: sp.q,
      ...params,
    };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/admin/invoices${u.size ? `?${u}` : ""}`;
  };

  let rows: Row[] = [];
  let totalCount = 0;

  if (view === "manual") {
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
  const searchHint = view === "manual" ? "Invoice number, name or company" : "Order number, email or name";

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Invoices for shop orders and ones written by hand, ready to save as a PDF. Ring a customer straight from the list."
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
              view: v.key === "manual" ? undefined : v.key,
              tab: undefined,
              q: undefined,
              page: undefined,
            })}
            className={cn("flex-1 rounded-[2px] px-3 py-1.5 text-center", v.key === view ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}
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
        <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-ink/15 text-left text-xs text-stone-500 md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Telephone</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((r) => (
                <tr key={r.id} className="block px-4 py-3 md:table-row md:p-0">
                  <td className="block md:table-cell md:px-5 md:py-3.5">
                    <Link href={r.href} className="font-display text-lg tabular-nums text-aubergine-900 hover:underline">
                      {r.label}
                    </Link>
                    <span className="ml-2 text-xs text-stone-500 md:ml-0 md:block">{r.date}</span>
                  </td>
                  <td className="block md:table-cell md:px-3 md:py-3.5">
                    <span className="font-medium">{r.name}</span>
                    {r.company && <span className="block text-xs text-stone-500">{r.company}</span>}
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="block text-xs text-stone-500 hover:text-aubergine-700">
                        {r.email}
                      </a>
                    )}
                  </td>
                  <td className="mt-1 block md:mt-0 md:table-cell md:px-3 md:py-3.5">
                    {r.phone ? <span className="tabular-nums text-ink-soft">{r.phone}</span> : <span className="text-xs italic text-stone-500">No number on file</span>}
                  </td>
                  <td className="mt-2 inline-block md:mt-0 md:table-cell md:px-3 md:py-3.5">{r.payment}</td>
                  <td className="ml-3 mt-2 inline-block font-medium tabular-nums md:ml-0 md:mt-0 md:table-cell md:px-3 md:py-3.5 md:text-right">{formatPence(r.total)}</td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-5 md:py-3.5">
                    <div className="flex gap-2 md:justify-end">
                      {r.phone && (
                        <a href={telHref(r.phone)} className={btn("secondary", "sm")} title={`Call ${r.name}`}>
                          <IconPhone className="size-4" /> Call
                        </a>
                      )}
                      <ButtonLink href={r.pdf} target="_blank" size="sm">
                        <IconDocument className="size-4" /> PDF
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
