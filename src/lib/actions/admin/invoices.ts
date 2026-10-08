"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { vatFromGross } from "@/lib/finance/calc";
import { invoiceTotal, type BillTo, type ManualCustomer } from "@/lib/invoices";
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
  const cols = "id, full_name, company, email, phone, line1, line2, city, county, postcode, note";
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
  return ok(data as ManualCustomer, "Customer added.");
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
          description: z.string().trim().min(1, "Every line needs a description").max(300),
          quantity: z.number().positive("Quantities must be more than zero").max(100000),
          unit_price_pence: z.number().int().min(0).max(100_000_000),
        }),
      )
      .min(1, "Add at least one line")
      .max(100),
    issued_on: day,
    due_on: day.nullable(),
    note: text(2000),
    paid: z.boolean(),
  })
  .refine((v) => !v.due_on || v.due_on >= v.issued_on, "The due date can't be before the invoice date");

export type InvoiceInput = z.input<typeof invoiceSchema>;

export async function saveInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the invoice.");
  const { id, customer_id, paid, ...rest } = parsed.data;
  const { db, viewer } = await staffDb();

  const [{ data: customer }, { data: settings }, existing] = await Promise.all([
    db.from("manual_customers").select("full_name, company, email, phone, line1, line2, city, county, postcode").eq("id", customer_id).maybeSingle(),
    db.from("finance_settings").select("vat_rate").maybeSingle(),
    id ? db.from("invoices").select("paid_at").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!customer) return fail("That customer has been removed. Please choose another.");
  if (id && !existing.data) return fail("That invoice has been deleted.");

  const total = invoiceTotal(rest.items);
  const row = {
    ...rest,
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
