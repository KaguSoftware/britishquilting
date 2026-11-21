"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { allocationErrors, destinationLines, type Destination } from "@/lib/delivery-notes";
import { loadNoteInvoice, type NoteInvoice } from "@/lib/data/delivery-notes";
import { manualInvoiceNo, parseCid } from "@/lib/invoices";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const noteSchema = z.object({
  id: z.uuid().optional(),
  invoice_id: z.uuid({ message: "Please choose the invoice these goods are for" }),
  po_number: text(60),
  reference: text(120),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date"),
  note: text(2000),
  destinations: z
    .array(
      z.object({
        label: z.string().trim().max(80),
        address: z.string().trim().max(500),
        items: z.array(z.object({ line: z.number().int().min(0).max(1000), qty: z.number().positive("Every line needs a quantity above zero").max(100000) })).max(100),
      }),
    )
    .min(1, "Add at least one delivery place")
    .max(30, "Keep it to 30 places or fewer"),
});

export type DeliveryNoteInput = z.input<typeof noteSchema>;

const refresh = (invoiceId?: string) => {
  revalidatePath("/admin/delivery-notes", "layout");
  revalidatePath("/admin/customers", "layout");
  if (invoiceId) revalidatePath(`/admin/invoices/${invoiceId}`);
};

/** The invoice a delivery note is written from, with its lines and addresses. */
export async function getNoteInvoice(id: string): Promise<NoteInvoice | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { db } = await staffDb();
  return loadNoteInvoice(db, id);
}

export type InvoiceOption = { id: string; number: number; name: string; company: string | null; issued_on: string; total_pence: number; lines: number };

/** Invoices that don't have a delivery note yet, newest first: by number (1023, INV-M1023) or who they're for. */
export async function searchInvoicesForNote(q: string, customerId?: string | null): Promise<InvoiceOption[]> {
  const { db } = await staffDb();
  const term = String(q ?? "").slice(0, 100).replace(/[%,()\\*]/g, " ").trim();
  let query = db
    .from("invoices")
    .select("id, number, bill_to, issued_on, total_pence, items, delivery_notes!delivery_notes_invoice_id_fkey(id)")
    .order("issued_on", { ascending: false })
    .order("number", { ascending: false })
    .limit(40);
  if (customerId && z.uuid().safeParse(customerId).success) query = query.eq("customer_id", customerId);
  const n = term.replace(/^(inv-?m?|#)/i, "");
  if (/^\d+$/.test(n)) query = query.eq("number", Number(n));
  else if (term) {
    const cid = parseCid(term);
    query = query.or(`bill_to->>full_name.ilike.%${term}%,bill_to->>company.ilike.%${term}%${cid != null ? `,bill_to->>number.eq.${cid}` : ""}`);
  }
  const { data } = await query;
  type Row = { id: string; number: number; bill_to: { full_name: string; company: string | null }; issued_on: string; total_pence: number; items: unknown[]; delivery_notes: { id: string }[] | { id: string } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => !(Array.isArray(r.delivery_notes) ? r.delivery_notes.length : r.delivery_notes))
    .slice(0, 20)
    .map((r) => ({ id: r.id, number: r.number, name: r.bill_to.full_name, company: r.bill_to.company, issued_on: r.issued_on, total_pence: r.total_pence, lines: r.items.length }));
}

export async function saveDeliveryNote(input: DeliveryNoteInput): Promise<ActionResult<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the delivery note.");
  const { id, invoice_id, destinations: raw, ...rest } = parsed.data;
  const { db, viewer } = await staffDb();

  const [invoice, existing, { data: taken }] = await Promise.all([
    loadNoteInvoice(db, invoice_id),
    id ? db.from("delivery_notes").select("id").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("delivery_notes").select("id, number").eq("invoice_id", invoice_id).maybeSingle(),
  ]);
  if (!invoice) return fail("That invoice has been deleted. Please choose another.");
  if (id && !existing.data) return fail("That delivery note has been deleted.");
  if (taken && taken.id !== id) return fail(`Invoice ${manualInvoiceNo(invoice.number)} already has delivery note DN-${taken.number}.`);

  // The same invoice line twice in one place counts as one line.
  const destinations: Destination[] = raw.map((d) => {
    const merged = new Map<number, number>();
    for (const x of d.items) merged.set(x.line, (merged.get(x.line) ?? 0) + x.qty);
    return { label: d.label, address: d.address, items: [...merged].map(([line, qty]) => ({ line, qty })) };
  });
  const problems = allocationErrors(invoice.items, destinations);
  if (problems.length) return fail(problems[0]);

  const row = {
    ...rest,
    invoice_id,
    customer_id: invoice.customer_id,
    company_id: invoice.company_id,
    invoice_to: invoice.bill_to,
    destinations,
    items: destinationLines(invoice.items, destinations),
    // The money is the invoice's: the note delivers exactly what was invoiced.
    total_pence: invoice.total_pence,
    deliver_to: destinations[0].address || null,
  };

  if (id) {
    const { error } = await db.from("delivery_notes").update(row).eq("id", id);
    if (error) return fail("Couldn't save the delivery note. Please try again.");
    await audit(db, viewer.id, "delivery_note.update", "delivery_note", id, { places: destinations.length });
    refresh(invoice_id);
    return ok({ id }, "Delivery note saved.");
  }
  const { data, error } = await db
    .from("delivery_notes")
    .insert({ ...row, created_by: viewer.id })
    .select("id, number")
    .single();
  if (error || !data) return fail("Couldn't create the delivery note. Please try again.");
  await audit(db, viewer.id, "delivery_note.create", "delivery_note", data.id, { number: data.number, invoice: invoice.number, places: destinations.length });
  refresh(invoice_id);
  return ok({ id: data.id }, "Delivery note created.");
}

export async function deleteDeliveryNote(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid delivery note.");
  const { db, viewer } = await staffDb();
  const { data: row } = await db.from("delivery_notes").select("number, total_pence, invoice_id").eq("id", id).maybeSingle();
  if (!row) return fail("That delivery note has already gone.");
  const { error } = await db.from("delivery_notes").delete().eq("id", id);
  if (error) return fail("Couldn't delete the delivery note.");
  await audit(db, viewer.id, "delivery_note.delete", "delivery_note", id, row);
  refresh(row.invoice_id ?? undefined);
  return ok(undefined, "Delivery note deleted.");
}
