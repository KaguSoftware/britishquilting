import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { formatDate } from "@/components/admin/format";
import { InvoiceDocument } from "@/components/admin/invoices/invoice-document";
import { billToLines, lineAmount, manualInvoiceNo, type ManualInvoice } from "@/lib/invoices";

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

export default async function ManualInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const { db } = await staffDb();
  const { data } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as ManualInvoice;

  return (
    <InvoiceDocument
      doc={{
        label: manualInvoiceNo(inv.number),
        issued: formatDate(inv.issued_on),
        due: inv.due_on ? formatDate(inv.due_on) : null,
        status: inv.paid_at ? `Paid ${formatDate(inv.paid_at)}` : "Awaiting payment",
        billTo: billToLines(inv.bill_to),
        email: inv.bill_to.email,
        phone: inv.bill_to.phone,
        lines: inv.items.map((l, i) => ({
          key: String(i),
          description: l.description,
          quantity: Number(l.quantity).toLocaleString("en-GB", {
            maximumFractionDigits: 2,
          }),
          unit: formatPence(l.unit_price_pence),
          amount: formatPence(lineAmount(l)),
        })),
        total: formatPence(inv.total_pence),
        vat: inv.vat_included_pence > 0 ? formatPence(inv.vat_included_pence) : null,
        note: inv.note,
      }}
    />
  );
}
