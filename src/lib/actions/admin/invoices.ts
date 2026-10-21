"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { vatFromGross } from "@/lib/finance/calc";
import { customerNo, invoiceTotal, type BillTo, type InvoiceLine, type ManualCustomer, type ProductPick } from "@/lib/invoices";
import { deliveryNotesFor, findManualCustomers, findProducts, productPrices } from "@/lib/data/invoices";
import type { DeliveryNoteOption } from "@/lib/delivery-notes";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const customerSchema = z.object({
  id: z.uuid().optional(),
  full_name: z.string().trim().min(2, "Please enter the customer's name").max(120),
  company: text(120),
  email: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v == null || z.email().safeParse(v).success, "That email address doesn't look right"),
  phone: text(40).refine((v) => v == null || /^[+\d][\d\s()-]{5,}$/.test(v), "That phone number doesn't look right"),
  line1: text(200),
  line2: text(200),
  city: text(100),
  county: text(100),
  postcode: text(12),
  note: text(1000),
});

/** The customer search on the invoice and delivery note pads. */
export async function searchManualCustomers(q: string): Promise<ManualCustomer[]> {
  const { db } = await staffDb();
  return findManualCustomers(db, String(q ?? "").slice(0, 100));
}

/** The product search on the invoice pad: by code (LIN3RED) or by name. */
export async function searchProducts(q: string): Promise<ProductPick[]> {
  const { db } = await staffDb();
  return findProducts(db, String(q ?? "").slice(0, 100));
}

/** A customer's delivery notes, for the DEL Note No box on an invoice. */
export async function customerDeliveryNotes(customerId: string): Promise<DeliveryNoteOption[]> {
  if (!z.uuid().safeParse(customerId).success) return [];
  const { db } = await staffDb();
  return deliveryNotesFor(db, customerId);
}

export type ManualCustomerInput = z.input<typeof customerSchema>;

const refresh = () => {
  revalidatePath("/admin/invoices", "layout");
  revalidatePath("/admin/customers");
};

export async function saveManualCustomer(input: ManualCustomerInput): Promise<ActionResult<ManualCustomer>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the customer's details.");
  const { db, viewer } = await staffDb();
  const { id, ...row } = parsed.data;
  const cols = "id, number, full_name, company, email, phone, line1, line2, city, county, postcode, note";
  if (id) {
    const { data, error } = await db.from("manual_customers").update(row).eq("id", id).select(cols).single();
    if (error || !data) return fail("Couldn't save the customer. Please try again.");
    await audit(db, viewer.id, "manual_customer.update", "manual_customer", id);
    refresh();
    return ok(data as ManualCustomer, "Customer saved.");
  }
  const { data, error } = await db
    .from("manual_customers")
    .insert({ ...row, created_by: viewer.id })
    .select(cols)
    .single();
  if (error || !data) return fail("Couldn't add the customer. Please try again.");
  await audit(db, viewer.id, "manual_customer.create", "manual_customer", data.id, { full_name: row.full_name });
  refresh();
  return ok(data as ManualCustomer, `Customer added as ${customerNo((data as ManualCustomer).number)}.`);
}

/** Invoices already written for this customer keep their copy of the details. */
export async function deleteManualCustomer(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid customer.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("manual_customers").delete().eq("id", id);
  if (error) return fail("Couldn't remove the customer.");
  await audit(db, viewer.id, "manual_customer.delete", "manual_customer", id);
  refresh();
  return ok(undefined, "Customer removed.");
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date");

const invoiceSchema = z
  .object({
    id: z.uuid().optional(),
    customer_id: z.uuid({ message: "Please choose who the invoice is for" }),
    items: z
      .array(
        z.object({
          code: text(40),
          description: z.string().trim().min(1, "Every line needs a description").max(300),
          quantity: z.number().positive("Quantities must be more than zero").max(100000),
          unit_price_pence: z.number().int().min(0).max(100_000_000),
          list_price_pence: z.number().int().min(0).max(100_000_000).nullish(),
        }),
      )
      .min(1, "Add at least one product")
      .max(100),
    issued_on: day,
    due_on: day.nullable(),
    note: text(2000),
    deliver_to: text(500),
    po_number: text(60),
    customer_code: text(40),
    delivery_note_id: z.uuid().nullish().transform((v) => v ?? null),
    paid: z.boolean(),
  })
  .refine((v) => !v.due_on || v.due_on >= v.issued_on, "The due date can't be before the invoice date");

export type InvoiceInput = z.input<typeof invoiceSchema>;

export async function saveInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the invoice.");
  const { id, customer_id, paid, ...rest } = parsed.data;
  const { db, viewer } = await staffDb();

  const codes = [...new Set(rest.items.flatMap((l) => (l.code ? [l.code.toUpperCase()] : [])))];
  const [{ data: customer }, { data: settings }, existing, note, price] = await Promise.all([
    db.from("manual_customers").select("number, full_name, company, email, phone, line1, line2, city, county, postcode").eq("id", customer_id).maybeSingle(),
    db.from("finance_settings").select("vat_rate").maybeSingle(),
    id ? db.from("invoices").select("paid_at, items").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    rest.delivery_note_id ? db.from("delivery_notes").select("customer_id").eq("id", rest.delivery_note_id).maybeSingle() : Promise.resolve({ data: null }),
    productPrices(db, codes),
  ]);
  if (!customer) return fail("That customer has been removed. Please choose another.");
  if (id && !existing.data) return fail("That invoice has been deleted.");
  if (rest.delivery_note_id && note.data?.customer_id !== customer_id) return fail("That delivery note is for a different customer. Please choose another.");

  // Every line is a product picked from the search. Its price can be changed by hand (the editor asks first); the
  // shop's price is kept beside it. Lines the invoice was already saved with are kept, even if the product has gone.
  const before = (existing.data?.items ?? []) as InvoiceLine[];
  const items: InvoiceLine[] = [];
  for (const [i, l] of rest.items.entries()) {
    const code = l.code?.toUpperCase() ?? null;
    const kept = before.some((b) => (b.code ?? null) === code && (code || (b.description === l.description && b.quantity === l.quantity && b.unit_price_pence === l.unit_price_pence)));
    if (!code) {
      if (!kept) return fail(`Line ${i + 1}: please pick a product from the search.`);
      items.push({ code, description: l.description, quantity: l.quantity, unit_price_pence: l.unit_price_pence });
      continue;
    }
    const shop = price.get(code) ?? before.find((b) => b.code === code)?.list_price_pence ?? null;
    if (shop == null && !kept) return fail(`Line ${i + 1}: ${code} isn't a product any more. Please pick it again from the search.`);
    const list = l.list_price_pence ?? shop;
    items.push({ code, description: l.description, quantity: l.quantity, unit_price_pence: l.unit_price_pence, ...(list != null && list !== l.unit_price_pence ? { list_price_pence: list } : {}) });
  }

  const total = invoiceTotal(items);
  const row = {
    ...rest,
    items,
    customer_id,
    bill_to: customer as BillTo,
    total_pence: total,
    vat_included_pence: vatFromGross(total, Number(settings?.vat_rate ?? 20)),
    paid_at: paid ? (existing.data?.paid_at ?? new Date().toISOString()) : null,
  };

  if (id) {
    const { error } = await db.from("invoices").update(row).eq("id", id);
    if (error) return fail("Couldn't save the invoice. Please try again.");
    await audit(db, viewer.id, "invoice.update", "invoice", id, {
      total_pence: total,
    });
    refresh();
    return ok({ id }, "Invoice saved.");
  }
  const { data, error } = await db
    .from("invoices")
    .insert({ ...row, created_by: viewer.id })
    .select("id, number")
    .single();
  if (error || !data) return fail("Couldn't create the invoice. Please try again.");
  await audit(db, viewer.id, "invoice.create", "invoice", data.id, {
    number: data.number,
    total_pence: total,
  });
  refresh();
  return ok({ id: data.id }, "Invoice created.");
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid invoice.");
  const { db, viewer } = await staffDb();
  const { data: row } = await db.from("invoices").select("number, total_pence").eq("id", id).maybeSingle();
  if (!row) return fail("That invoice has already gone.");
  const { error } = await db.from("invoices").delete().eq("id", id);
  if (error) return fail("Couldn't delete the invoice.");
  await audit(db, viewer.id, "invoice.delete", "invoice", id, row);
  refresh();
  return ok(undefined, "Invoice deleted.");
}
