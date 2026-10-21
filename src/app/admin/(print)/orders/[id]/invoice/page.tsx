import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { addressLines, cutInstruction, formatDate, type Address } from "@/components/admin/format";
import { InvoiceDocument } from "@/components/admin/invoices/invoice-document";
import { docAction } from "@/lib/doc-action";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// The document title becomes the default file name in the browser's "Save as PDF" dialog.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isId(id)) return { title: "Invoice" };
  const { db } = await staffDb();
  const { data } = await db.from("orders").select("number").eq("id", id).maybeSingle();
  return {
    title: { absolute: data ? `Invoice INV-${data.number}` : "Invoice" },
  };
}

export default async function OrderInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isId(id)) notFound();
  const { db } = await staffDb();
  const [{ data: order }, { data: items }] = await Promise.all([
    db.from("orders").select("*, profile:profiles(full_name, phone, company_name)").eq("id", id).maybeSingle(),
    db.from("order_items").select("*").eq("order_id", id),
  ]);
  if (!order) notFound();

  const ship = order.shipping_address as Address | null;
  const bill = (order.billing_address as Address | null) ?? ship;
  const profile = (Array.isArray(order.profile) ? order.profile[0] : order.profile) as {
    full_name: string | null;
    phone: string | null;
    company_name: string | null;
  } | null;
  const invoiceTo = addressLines(bill);
  if (!invoiceTo.length) invoiceTo.push(profile?.full_name ?? order.email);
  if (!bill?.company && profile?.company_name) invoiceTo.splice(1, 0, profile.company_name);
  const phone = bill?.phone ?? ship?.phone ?? profile?.phone;
  if (phone) invoiceTo.push(phone);
  const londonDay = (d: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London" }).format(new Date(d));

  return (
    <InvoiceDocument
      action={docAction(sp.do)}
      doc={{
        number: `INV-${order.number}`,
        date: londonDay(order.created_at),
        poNumber: `Order #${order.number}`,
        invoiceTo,
        deliverTo: order.fulfilment === "collection" ? ["Collected"] : addressLines(ship),
        lines: (items ?? []).map((i) => ({
          key: i.id,
          // The QTY box is narrow, so lengths read "2m x 3" rather than the packing slip's "Cut 2m x 3".
          quantity: cutInstruction({ ...i, length_m: i.length_m == null ? null : Number(i.length_m) }).replace(/^Cut /, ""),
          description: i.name,
          price: formatPence(i.unit_price_pence),
          amount: formatPence(i.line_total_pence),
        })),
        extras: [
          ...(order.discount_pence > 0
            ? [{ key: "discount", description: `Discount${order.discount_code ? ` (${order.discount_code})` : ""}`, amount: `\u2212${formatPence(order.discount_pence)}` }]
            : []),
          {
            key: "delivery",
            description: order.fulfilment === "collection" ? "Collection" : (order.shipping_name ?? "Delivery"),
            amount: order.shipping_pence ? formatPence(order.shipping_pence) : "Free",
          },
          ...(order.paid_at
            ? [{ key: "paid", description: `Paid with thanks, ${formatDate(order.paid_at)}` }]
            : order.invoice_due_at
              ? [{ key: "due", description: `Payment due by ${formatDate(order.invoice_due_at)}` }]
              : []),
        ],
        net: formatPence(order.total_pence - order.vat_included_pence),
        vat: formatPence(order.vat_included_pence),
        total: formatPence(order.total_pence),
      }}
    />
  );
}
