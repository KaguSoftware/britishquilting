import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { addressLines, cutInstruction, formatDate, type Address } from "@/components/admin/format";
import { InvoiceDocument } from "@/components/admin/invoices/invoice-document";

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

export default async function OrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const billTo = addressLines(bill);
  if (!billTo.length) billTo.push(profile?.full_name ?? order.email);
  if (!bill?.company && profile?.company_name) billTo.splice(1, 0, profile.company_name);

  return (
    <InvoiceDocument
      doc={{
        label: `INV-${order.number}`,
        issued: formatDate(order.created_at),
        due: order.invoice_due_at ? formatDate(order.invoice_due_at) : null,
        status: order.paid_at ? `Paid ${formatDate(order.paid_at)}` : "Awaiting payment",
        reference: { label: "Order", value: `#${order.number}` },
        billTo,
        email: order.email,
        phone: ship?.phone ?? bill?.phone ?? profile?.phone,
        lines: (items ?? []).map((i) => ({
          key: i.id,
          description: i.name,
          quantity: cutInstruction({
            ...i,
            length_m: i.length_m == null ? null : Number(i.length_m),
          }),
          unit: formatPence(i.unit_price_pence),
          amount: formatPence(i.line_total_pence),
        })),
        adjustments: [
          { label: "Subtotal", value: formatPence(order.subtotal_pence) },
          ...(order.discount_pence > 0
            ? [
                {
                  label: `Discount${order.discount_code ? ` (${order.discount_code})` : ""}`,
                  value: `−${formatPence(order.discount_pence)}`,
                },
              ]
            : []),
          {
            label: order.fulfilment === "collection" ? "Collection" : (order.shipping_name ?? "Delivery"),
            value: order.shipping_pence ? formatPence(order.shipping_pence) : "Free",
          },
        ],
        total: formatPence(order.total_pence),
        vat: order.vat_included_pence > 0 ? formatPence(order.vat_included_pence) : null,
      }}
    />
  );
}
