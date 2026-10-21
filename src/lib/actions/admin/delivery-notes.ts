"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deliveryTotal, lineAmountPence, qtyLabel, type DeliveryLine } from "@/lib/delivery-notes";
import type { BillTo } from "@/lib/invoices";
import { productPrices } from "@/lib/data/invoices";
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
  customer_id: z.uuid({ message: "Please choose who the delivery note is for" }),
  deliver_to: text(500),
  po_number: text(60),
  reference: text(120),
  items: z
    .array(
      z.union([
        // A product picked from the search: the amount is worked out here, never taken from the browser.
        z.object({
          code: z.string().trim().min(1).max(40),
          description: z.string().trim().min(1).max(300),
          qty: z.number().positive("Every product needs a quantity above zero").max(100000),
          unit_price_pence: z.number().int().min(0).max(100_000_000),
          per: z.string().max(20).nullable(),
        }),
        // A line written by hand before products had to be picked; only kept as it was.
        z.object({
          code: z.null().optional(),
          quantity: z.string().trim().max(40),
          description: z.string().trim().min(1).max(300),
          amount_pence: z.number().int().min(0).max(100_000_000).nullable(),
        }),
      ]),
    )
    .min(1, "Add at least one product")
    .max(100),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date"),
  note: text(2000),
});

export type DeliveryNoteInput = z.input<typeof noteSchema>;

const refresh = () => {
  revalidatePath("/admin/delivery-notes", "layout");
  revalidatePath("/admin/customers", "layout");
};

export async function saveDeliveryNote(input: DeliveryNoteInput): Promise<ActionResult<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the delivery note.");
  const { id, customer_id, ...rest } = parsed.data;
  const { db, viewer } = await staffDb();

  const codes = [...new Set(rest.items.flatMap((l) => ("qty" in l ? [l.code.toUpperCase()] : [])))];
  const [{ data: customer }, existing, price] = await Promise.all([
    db.from("manual_customers").select("number, full_name, company, email, phone, line1, line2, city, county, postcode").eq("id", customer_id).maybeSingle(),
    id ? db.from("delivery_notes").select("id, items").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    productPrices(db, codes),
  ]);
  if (!customer) return fail("That customer has been removed. Please choose another.");
  if (id && !existing.data) return fail("That delivery note has been deleted.");

  // What this note was saved with before: old notes keep their prices.
  const before = ((existing.data?.items ?? []) as DeliveryLine[]);

  const items: DeliveryLine[] = [];
  for (const [i, l] of rest.items.entries()) {
    if ("qty" in l) {
      const code = l.code.toUpperCase();
      const now = price.get(code);
      const kept = before.some((b) => b.code === code && b.unit_price_pence === l.unit_price_pence);
      if (now == null && !kept) return fail(`Line ${i + 1}: ${code} isn't a product any more. Please pick it again from the search.`);
      if (l.unit_price_pence !== now && !kept) return fail(`Line ${i + 1}: the price of ${code} has changed. Please pick it again from the search.`);
      items.push({
        code,
        description: l.description,
        qty: l.qty,
        unit_price_pence: l.unit_price_pence,
        per: l.per,
        quantity: qtyLabel(l.qty, l.per),
        amount_pence: lineAmountPence(l.qty, l.unit_price_pence),
      });
    } else {
      const same = before.some((b) => !b.code && b.description === l.description && b.quantity === l.quantity && b.amount_pence === l.amount_pence);
      if (!same) return fail(`Line ${i + 1}: please pick a product from the search.`);
      items.push({ quantity: l.quantity, description: l.description, amount_pence: l.amount_pence });
    }
  }

  const total = deliveryTotal(items);
  const row = { ...rest, items, customer_id, invoice_to: customer as BillTo, total_pence: total };

  if (id) {
    const { error } = await db.from("delivery_notes").update(row).eq("id", id);
    if (error) return fail("Couldn't save the delivery note. Please try again.");
    await audit(db, viewer.id, "delivery_note.update", "delivery_note", id, { total_pence: total });
    refresh();
    return ok({ id }, "Delivery note saved.");
  }
  const { data, error } = await db
    .from("delivery_notes")
    .insert({ ...row, created_by: viewer.id })
    .select("id, number")
    .single();
  if (error || !data) return fail("Couldn't create the delivery note. Please try again.");
  await audit(db, viewer.id, "delivery_note.create", "delivery_note", data.id, { number: data.number, total_pence: total });
  refresh();
  return ok({ id: data.id }, "Delivery note created.");
}

export async function deleteDeliveryNote(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid delivery note.");
  const { db, viewer } = await staffDb();
  const { data: row } = await db.from("delivery_notes").select("number, total_pence").eq("id", id).maybeSingle();
  if (!row) return fail("That delivery note has already gone.");
  const { error } = await db.from("delivery_notes").delete().eq("id", id);
  if (error) return fail("Couldn't delete the delivery note.");
  await audit(db, viewer.id, "delivery_note.delete", "delivery_note", id, row);
  refresh();
  return ok(undefined, "Delivery note deleted.");
}
