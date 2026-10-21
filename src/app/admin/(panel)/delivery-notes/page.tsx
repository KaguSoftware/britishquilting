import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconDeliveryNote, IconDownload, IconPlus, IconPrint } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { deliveryNoteNo, type DeliveryLine } from "@/lib/delivery-notes";
import type { BillTo } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { OrderSearch } from "@/components/admin/orders/order-search";

export const metadata = { title: "Delivery notes" };

const PAGE_SIZE = 50;

export default async function DeliveryNotesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const { db } = await staffDb();

  const href = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, ...params })) if (v) u.set(k, v);
    return `/admin/delivery-notes${u.size ? `?${u}` : ""}`;
  };

  let rowsQuery = db
    .from("delivery_notes")
    .select("id, number, invoice_to, deliver_to, items, total_pence, issued_on")
    .order("issued_on", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  let countQuery = db.from("delivery_notes").select("id", { count: "exact", head: true });
  if (q) {
    const n = q.replace(/^(#|dn-?)/i, "");
    const filter = /^\d+$/.test(n)
      ? `number.eq.${n}`
      : `invoice_to->>full_name.ilike.%${q}%,invoice_to->>company.ilike.%${q}%,po_number.ilike.%${q}%,reference.ilike.%${q}%`;
    rowsQuery = rowsQuery.or(filter);
    countQuery = countQuery.or(filter);
  }
  const [{ data }, { count }] = await Promise.all([rowsQuery, countQuery]);
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = (data ?? []).map((n) => {
    const to = n.invoice_to as BillTo;
    const items = n.items as DeliveryLine[];
    return {
      id: n.id as string,
      label: deliveryNoteNo(n.number),
      date: formatDate(n.issued_on),
      name: to.full_name,
      company: to.company,
      deliverTo: ((n.deliver_to as string | null) ?? "").split("\n")[0] || null,
      goods: `${items.length} line${items.length === 1 ? "" : "s"}`,
      total: items.some((l) => l.amount_pence != null) ? formatPence(n.total_pence) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Delivery notes"
        description="Delivery notes laid out like the printed pad, ready to print or download as a PDF."
        actions={
          <ButtonLink href="/admin/delivery-notes/new">
            <IconPlus className="size-4" /> New delivery note
          </ButtonLink>
        }
      />

      <div className="mb-5 flex justify-end">
        <OrderSearch initial={sp.q ?? ""} path="/admin/delivery-notes" placeholder="Number, customer, P/O or reference" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconDeliveryNote />}
          title={q ? "No delivery notes match that search" : "No delivery notes yet"}
          description={q ? "Try the number on its own, e.g. 1001, or part of the customer's name." : "Write one whenever goods go out or are collected."}
          action={
            q ? (
              <ButtonLink href={href({ q: undefined, page: undefined })} variant="secondary">
                Clear the search
              </ButtonLink>
            ) : (
              <ButtonLink href="/admin/delivery-notes/new">
                <IconPlus className="size-4" /> New delivery note
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-ink/15 text-left text-xs text-stone-500 md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Delivery note</th>
                <th className="px-3 py-3 font-medium">Invoice to</th>
                <th className="px-3 py-3 font-medium">Deliver to</th>
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
                    <Link href={`/admin/delivery-notes/${r.id}`} className="font-display text-lg tabular-nums text-aubergine-900 hover:underline">
                      {r.label}
                    </Link>
                    <span className="ml-2 text-xs text-stone-500 md:ml-0 md:block">{r.date}</span>
                  </td>
                  <td className="block md:table-cell md:px-3 md:py-3.5">
                    <span className="font-medium">{r.name}</span>
                    {r.company && <span className="block text-xs text-stone-500">{r.company}</span>}
                  </td>
                  <td className="mt-1 block text-ink-soft md:mt-0 md:table-cell md:max-w-xs md:px-3 md:py-3.5">
                    {r.deliverTo ? <span className="line-clamp-1">{r.deliverTo}</span> : <span className="text-xs italic text-stone-500">Not filled in</span>}
                    <span className="block text-xs text-stone-500">{r.goods}</span>
                  </td>
                  <td className="mt-2 block font-medium tabular-nums md:mt-0 md:table-cell md:px-3 md:py-3.5 md:text-right">
                    {r.total ?? <span className="text-xs font-normal italic text-stone-500">No prices</span>}
                  </td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-5 md:py-3.5">
                    <div className="flex gap-2 md:justify-end">
                      <ButtonLink href={`/admin/delivery-notes/${r.id}/print?do=print`} target="_blank" variant="secondary" size="sm">
                        <IconPrint className="size-4" /> Print
                      </ButtonLink>
                      <ButtonLink href={`/admin/delivery-notes/${r.id}/print?do=pdf`} target="_blank" size="sm">
                        <IconDownload className="size-4" /> PDF
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
            Page {page} of {totalPages} &middot; {totalCount} delivery note{totalCount === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <ButtonLink href={href({ page: page > 1 ? String(page - 1) : undefined })} variant="secondary" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-40")}>
              <IconChevronLeft className="size-4" /> Previous
            </ButtonLink>
            <ButtonLink
              href={href({ page: page < totalPages ? String(page + 1) : undefined })}
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
