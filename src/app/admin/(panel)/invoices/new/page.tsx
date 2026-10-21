import { staffDb } from "@/lib/actions/admin/guard";
import { editorData } from "@/lib/data/invoices";
import type { DeliveryLine } from "@/lib/delivery-notes";
import { PageHeader } from "@/components/admin/ui";
import { InvoiceEditor } from "@/components/admin/invoices/invoice-editor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string; delivery_note?: string }> }) {
  const { customer, delivery_note } = await searchParams;
  const { db } = await staffDb();
  // Started from a delivery note: it decides who the invoice is for.
  const { data: note } =
    delivery_note && /^[0-9a-f-]{36}$/i.test(delivery_note)
      ? await db.from("delivery_notes").select("customer_id, items").eq("id", delivery_note).maybeSingle()
      : { data: null };
  const data = await editorData(db, note?.customer_id ?? customer);
  const fromNote = data.deliveryNotes.find((n) => n.id === delivery_note) ?? null;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        title="New invoice"
        description="Write an invoice by hand, for a phone order, a trade account or anything outside the shop."
      />
      <InvoiceEditor
        invoice={null}
        customer={data.customer}
        deliveryNotes={data.deliveryNotes}
        fromNote={fromNote}
        fromNoteItems={fromNote ? ((note?.items ?? []) as DeliveryLine[]) : []}
        vatRate={data.vatRate}
      />
    </div>
  );
}
