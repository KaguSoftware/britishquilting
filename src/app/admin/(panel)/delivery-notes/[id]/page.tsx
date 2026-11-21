import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { loadNoteInvoice } from "@/lib/data/delivery-notes";
import { deliveryNoteNo, type DeliveryNote } from "@/lib/delivery-notes";
import { PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { DeliveryNoteEditor } from "@/components/admin/delivery-notes/delivery-note-editor";

export const metadata = { title: "Delivery note" };

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const { data } = await db.from("delivery_notes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const note = data as DeliveryNote;
  const invoice = note.invoice_id ? await loadNoteInvoice(db, note.invoice_id) : null;
  const places = (note.destinations ?? []).length;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/delivery-notes", label: "Delivery notes" }}
        title={deliveryNoteNo(note.number)}
        description={`For ${note.invoice_to.full_name}, dated ${formatDate(note.issued_on)}${places > 1 ? `, going to ${places} places` : ""}.`}
      />
      <DeliveryNoteEditor note={note} invoice={invoice} />
    </div>
  );
}
