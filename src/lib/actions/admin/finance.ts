"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, ownerDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

const CATS = EXPENSE_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const expenseSchema = z
  .object({
    id: z.uuid().optional(),
    spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose the date"),
    supplier: z.string().trim().min(1, "Who did you pay?").max(160),
    category: z.enum(CATS),
    amount_pence: z.number().int().min(0, "Please enter what you paid").max(100_000_000),
    vat_pence: z.number().int().min(0).max(100_000_000),
    note: z.string().trim().max(1000).optional().nullable(),
    receipt_path: z.string().max(300).optional().nullable(),
  })
  .refine((e) => e.vat_pence <= e.amount_pence, { message: "VAT can't be more than the total", path: ["vat_pence"] });

export type ExpenseInput = z.input<typeof expenseSchema>;

const refresh = () => revalidatePath("/admin/finance");

export async function saveExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the expense.");
  const { db, viewer } = await ownerDb();
  const { id, ...row } = parsed.data;
  if (row.receipt_path && !row.receipt_path.startsWith("expenses/")) return fail("That receipt isn't valid.");
  const clean = { ...row, note: row.note || null, receipt_path: row.receipt_path || null };
  if (id) {
    const { error } = await db.from("expenses").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail("Couldn't save the expense. Please try again.");
    await audit(db, viewer.id, "expense.update", "expense", id);
    refresh();
    return ok({ id }, "Expense saved.");
  }
  const { data, error } = await db.from("expenses").insert({ ...clean, created_by: viewer.id }).select("id").single();
  if (error || !data) return fail("Couldn't add the expense. Please try again.");
  await audit(db, viewer.id, "expense.create", "expense", data.id);
  refresh();
  return ok({ id: data.id }, "Expense added.");
}

/** Deletes an expense and hands back the row so it can be put back with Undo. The receipt file is kept for that. */
export async function deleteExpense(id: string): Promise<ActionResult<Record<string, unknown>>> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid expense.");
  const { db, viewer } = await ownerDb();
  const { data: row } = await db.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!row) return fail("That expense has already gone.");
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) return fail("Couldn't delete the expense.");
  await audit(db, viewer.id, "expense.delete", "expense", id, { supplier: row.supplier, amount_pence: row.amount_pence });
  refresh();
  return ok(row, "Expense deleted.");
}

export async function restoreExpense(row: Record<string, unknown>): Promise<ActionResult> {
  const { db, viewer } = await ownerDb();
  const id = String(row.id ?? "");
  if (!z.uuid().safeParse(id).success) return fail("Couldn't bring it back.");
  const { error } = await db.from("expenses").insert({
    id,
    spent_on: row.spent_on,
    supplier: row.supplier,
    category: row.category,
    amount_pence: row.amount_pence,
    vat_pence: row.vat_pence,
    note: row.note ?? null,
    receipt_path: row.receipt_path ?? null,
    created_by: row.created_by ?? viewer.id,
    created_at: row.created_at,
  });
  if (error) return fail("Couldn't bring it back.");
  await audit(db, viewer.id, "expense.restore", "expense", id);
  refresh();
  return ok();
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };

/** A one-time upload link into the private receipts bucket. */
export async function receiptUploadUrl(contentType: string): Promise<ActionResult<{ path: string; token: string }>> {
  const ext = EXT[contentType];
  if (!ext) return fail("Please use a photo (JPG, PNG, HEIC) or a PDF.");
  const { db } = await ownerDb();
  const d = new Date();
  const path = `expenses/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("receipts").createSignedUploadUrl(path);
  if (error || !data) return fail("Couldn't start the upload. Please try again.");
  return ok({ path: data.path, token: data.token });
}

/** A short-lived link to view a receipt. */
export async function receiptViewUrl(path: string): Promise<ActionResult<{ url: string }>> {
  if (!path.startsWith("expenses/")) return fail("That receipt isn't valid.");
  const { db } = await ownerDb();
  const { data, error } = await db.storage.from("receipts").createSignedUrl(path, 300);
  if (error || !data) return fail("Couldn't open the receipt.");
  return ok({ url: data.signedUrl });
}

const settingsSchema = z.object({
  stripe_pct: z.number().min(0).max(20),
  stripe_fixed_pence: z.number().int().min(0).max(500),
  paypal_pct: z.number().min(0).max(20),
  paypal_fixed_pence: z.number().int().min(0).max(500),
});

export async function saveFinanceSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the fee rates.");
  const { db, viewer } = await ownerDb();
  const { error } = await db.from("finance_settings").upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return fail("Couldn't save the fee rates.");
  await audit(db, viewer.id, "finance.settings", "finance_settings", null, parsed.data);
  refresh();
  return ok(undefined, "Fee rates saved.");
}
