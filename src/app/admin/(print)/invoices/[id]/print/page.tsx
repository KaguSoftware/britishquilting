import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { formatDate } from "@/components/admin/format";
import { InvoiceDocument } from "@/components/admin/invoices/invoice-document";
import { docAction } from "@/lib/doc-action";
import { addressBlock, customerNo, lineAmount, manualInvoiceNo, type ManualInvoice } from "@/lib/invoices";
import { padDate } from "@/lib/delivery-notes";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// The document title becomes the default file name in the browser's "Save as PDF" dialog.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isId(id)) return { title: "Invoice" };
  const { db } = await staffDb();
  const { data } = await db.from("invoices").select("number").eq("id", id).maybeSingle();
  return {
    title: {
      absolute: data ? `Invoice ${manualInvoiceNo(data.number)}` : "Invoice",
    },
  };
}

export default async function ManualInvoicePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isId(id)) notFound();
  const { db } = await staffDb();
  const { data } = await db.from("invoices").select("*, delivery_note:delivery_notes(number)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as ManualInvoice & { delivery_note: { number: number } | { number: number }[] | null };
  const dn = Array.isArray(inv.delivery_note) ? inv.delivery_note[0] : inv.delivery_note;
  const qty = (n: number) => Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const invoiceTo = addressBlock(inv.bill_to);

  return (
    <InvoiceDocument
      action={docAction(sp.do)}
      doc={{
        number: manualInvoiceNo(inv.number),
        date: padDate(inv.issued_on),
        delNoteNo: dn ? String(dn.number) : null,
        customerCode: inv.customer_code ?? (inv.bill_to.number ? customerNo(inv.bill_to.number) : null),
        poNumber: inv.po_number,
        invoiceTo,
        deliverTo: (inv.deliver_to ?? "").split("\n").filter((l) => l.trim()),
        lines: inv.items.map((l, i) => ({
          key: String(i),
          code: l.code,
          quantity: qty(l.quantity),
          description: l.description,
          price: formatPence(l.unit_price_pence),
          amount: formatPence(lineAmount(l)),
        })),
        extras: [
          ...(inv.paid_at
            ? [{ key: "paid", description: `Paid with thanks, ${formatDate(inv.paid_at)}` }]
            : inv.due_on
              ? [{ key: "due", description: `Payment due by ${formatDate(inv.due_on)}` }]
              : []),
          ...(inv.note ?? "")
            .split("\n")
            .filter((l) => l.trim())
            .map((l, i) => ({ key: `note-${i}`, description: l })),
        ],
        net: formatPence(inv.total_pence - inv.vat_included_pence),
        vat: formatPence(inv.vat_included_pence),
        total: formatPence(inv.total_pence),
      }}
    />
  );
}
