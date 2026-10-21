import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { addressBlock } from "@/lib/invoices";
import { deliveryNoteNo, padDate, padLineText, type DeliveryNote } from "@/lib/delivery-notes";
import { DeliveryNoteDocument, SHEET_ID } from "@/components/admin/delivery-notes/delivery-note-document";
import { DocumentToolbar } from "@/components/admin/documents/document-toolbar";
import { docAction } from "@/lib/doc-action";

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// The document title becomes the default file name in the browser's "Save as PDF" dialog.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isId(id)) return { title: "Delivery note" };
  const { db } = await staffDb();
  const { data } = await db.from("delivery_notes").select("number").eq("id", id).maybeSingle();
  return { title: { absolute: data ? `Delivery note ${deliveryNoteNo(data.number)}` : "Delivery note" } };
}

export default async function DeliveryNotePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isId(id)) notFound();
  const { db } = await staffDb();
  const { data } = await db.from("delivery_notes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const note = data as DeliveryNote;
  const invoiceTo = addressBlock(note.invoice_to);

  return (
    <DeliveryNoteDocument
      toolbar={
        <DocumentToolbar target={SHEET_ID} filename={`Delivery note ${deliveryNoteNo(note.number)}`} auto={docAction(sp.do)} />
      }
      doc={{
        number: String(note.number),
        date: padDate(note.issued_on),
        poNumber: note.po_number,
        reference: note.reference,
        invoiceTo,
        deliverTo: (note.deliver_to ?? "").split("\n").filter((l) => l.trim()),
        lines: note.items.map((l, i) => ({
          key: String(i),
          quantity: l.quantity,
          description: padLineText(l, formatPence),
          amount: l.amount_pence != null ? formatPence(l.amount_pence) : null,
        })),
        total: note.items.some((l) => l.amount_pence != null) ? formatPence(note.total_pence) : null,
        note: note.note,
      }}
    />
  );
}
