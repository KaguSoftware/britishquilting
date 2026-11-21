import { redirect } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { loadNoteInvoice } from "@/lib/data/delivery-notes";
import { manualInvoiceNo } from "@/lib/invoices";
import { PageHeader } from "@/components/admin/ui";
import { DeliveryNoteEditor } from "@/components/admin/delivery-notes/delivery-note-editor";
import { StartFromInvoice } from "@/components/admin/delivery-notes/start-from-invoice";

export const metadata = { title: "New delivery note" };

const isId = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function NewDeliveryNotePage({ searchParams }: { searchParams: Promise<{ invoice?: string; customer?: string }> }) {
  const { invoice: invoiceId, customer } = await searchParams;
  const { db } = await staffDb();
  const invoice = isId(invoiceId) ? await loadNoteInvoice(db, invoiceId!) : null;
  if (invoice) {
    // One delivery note per invoice: open the one it already has.
    const { data: existing } = await db.from("delivery_notes").select("id").eq("invoice_id", invoice.id).maybeSingle();
    if (existing) redirect(`/admin/delivery-notes/${existing.id}`);
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/delivery-notes", label: "Delivery notes" }}
        title="New delivery note"
        description={
          invoice
            ? `For the goods on ${manualInvoiceNo(invoice.number)}. Send everything to one place, or split it across several.`
            : "Delivery notes come from an invoice, so the goods and total always match it."
        }
      />
      {invoice ? <DeliveryNoteEditor note={null} invoice={invoice} /> : <StartFromInvoice customerId={isId(customer) ? customer : null} />}
    </div>
  );
}
