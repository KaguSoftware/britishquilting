import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { IconDeliveryNote, IconDocument, IconDownload, IconPhone, IconPlus, IconPrint } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { CUSTOMER_COLS } from "@/lib/data/invoices";
import { deliveryNoteNo, type DeliveryLine } from "@/lib/delivery-notes";
import { billToLines, customerNo, manualInvoiceNo, telHref, type ManualCustomer } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";
import { Badge, ButtonLink, Card, PageHeader, btn } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata = { title: "Customer" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/** One invoice or delivery note in the customer's lists, with its print and PDF buttons. */
function DocRow({ href, print, label, date, status, amount }: { href: string; print: string; label: string; date: string; status?: ReactNode; amount: string | null }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
      <Link href={href} className="font-display text-lg tabular-nums text-aubergine-900 hover:underline">
        {label}
      </Link>
      <span className="flex-1 text-sm text-stone-500">{date}</span>
      {status}
      <span className="w-20 text-right text-sm tabular-nums">{amount ?? "–"}</span>
      <span className="flex gap-1.5">
        <ButtonLink href={`${print}?do=print`} target="_blank" variant="secondary" size="sm" aria-label={`Print ${label}`}>
          <IconPrint className="size-4" />
        </ButtonLink>
        <ButtonLink href={`${print}?do=pdf`} target="_blank" variant="secondary" size="sm" aria-label={`Download ${label} as a PDF`}>
          <IconDownload className="size-4" /> PDF
        </ButtonLink>
      </span>
    </li>
  );
}

export default async function ManualCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data: c }, { data: invoices }, { data: notes }] = await Promise.all([
    db.from("manual_customers").select(CUSTOMER_COLS).eq("id", id).maybeSingle(),
    db
      .from("invoices")
      .select("id, number, total_pence, issued_on, due_on, paid_at")
      .eq("customer_id", id)
      .order("issued_on", { ascending: false })
      .order("number", { ascending: false }),
    db
      .from("delivery_notes")
      .select("id, number, items, total_pence, issued_on")
      .eq("customer_id", id)
      .order("issued_on", { ascending: false })
      .order("number", { ascending: false }),
  ]);
  if (!c) notFound();
  const customer = c as ManualCustomer;
  const invoiced = (invoices ?? []).reduce((s, i) => s + i.total_pence, 0);
  const unpaid = (invoices ?? []).filter((i) => !i.paid_at).reduce((s, i) => s + i.total_pence, 0);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/customers?view=manual", label: "Customers added by hand" }}
        title={customer.full_name}
        description={`Customer ${customerNo(customer.number)}${customer.company ? ` · ${customer.company}` : ", added by hand without a website account."}`}
        actions={
          <>
            <ButtonLink href={`/admin/delivery-notes/new?customer=${customer.id}`} variant="secondary">
              <IconPlus className="size-4" /> Delivery note
            </ButtonLink>
            <ButtonLink href={`/admin/invoices/new?customer=${customer.id}`}>
              <IconPlus className="size-4" /> Invoice
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 border-y border-ink/80">
        {[
          { label: "Invoiced", value: formatPence(invoiced) },
          { label: "Unpaid", value: formatPence(unpaid) },
          { label: "Delivery notes", value: String((notes ?? []).length) },
        ].map((s, i) => (
          <div key={s.label} className={"px-3 py-4 md:px-5 " + (i ? "border-l border-ink/15" : "")}>
            <p className="font-display text-2xl tabular-nums text-aubergine-900 md:text-4xl">{s.value}</p>
            <p className="text-sm text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Invoices" bodyClassName="p-0">
            {(invoices ?? []).length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-soft">
                <IconDocument className="size-4" /> No invoices yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {invoices!.map((i) => (
                  <DocRow
                    key={i.id}
                    href={`/admin/invoices/${i.id}`}
                    print={`/admin/invoices/${i.id}/print`}
                    label={manualInvoiceNo(i.number)}
                    date={formatDate(i.issued_on)}
                    status={
                      i.paid_at ? (
                        <Badge tone="green">Paid</Badge>
                      ) : i.due_on && i.due_on < today() ? (
                        <Badge tone="red">Overdue</Badge>
                      ) : (
                        <Badge tone="gold">Unpaid</Badge>
                      )
                    }
                    amount={formatPence(i.total_pence)}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Delivery notes" bodyClassName="p-0">
            {(notes ?? []).length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-soft">
                <IconDeliveryNote className="size-4" /> No delivery notes yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {notes!.map((n) => (
                  <DocRow
                    key={n.id}
                    href={`/admin/delivery-notes/${n.id}`}
                    print={`/admin/delivery-notes/${n.id}/print`}
                    label={deliveryNoteNo(n.number)}
                    date={formatDate(n.issued_on)}
                    amount={(n.items as DeliveryLine[]).some((l) => l.amount_pence != null) ? formatPence(n.total_pence) : null}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact">
            {customer.email && (
              <div className="flex items-center justify-between gap-2">
                <a href={`mailto:${customer.email}`} className="break-all text-aubergine-700 underline-offset-2 hover:underline">
                  {customer.email}
                </a>
                <CopyButton text={customer.email} />
              </div>
            )}
            {customer.phone ? (
              <a href={telHref(customer.phone)} className={btn("secondary", "sm") + " mt-3"}>
                <IconPhone className="size-4" /> Call {customer.phone}
              </a>
            ) : (
              <p className="text-sm italic text-stone-500">No number on file</p>
            )}
            {billToLines(customer).length > 1 && (
              <address className="mt-4 border-t border-ink/10 pt-4 text-sm not-italic leading-relaxed text-ink-soft">
                {billToLines(customer)
                  .slice(1)
                  .map((l, i) => (
                    <span key={i} className="block">
                      {l}
                    </span>
                  ))}
              </address>
            )}
            {customer.note && <p className="mt-4 whitespace-pre-line border-t border-ink/10 pt-4 text-sm text-ink-soft">{customer.note}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
