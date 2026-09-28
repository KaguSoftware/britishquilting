"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, ownerDb, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const rateSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Every delivery option needs a name").max(80),
  carrier: z.enum(["royal_mail", "dpd", "parcelforce", "other"]),
  min_weight_g: z.number().int().min(0),
  max_weight_g: z.number().int().min(1).nullable(),
  price_pence: z.number().int().min(0),
  estimated_days: z.string().trim().max(60).nullable(),
  is_active: z.boolean(),
});

export type RateInput = z.input<typeof rateSchema>;

export async function saveShipping(input: { rates: RateInput[]; freeThresholdPence: number | null }): Promise<ActionResult> {
  const parsed = z.object({ rates: z.array(rateSchema).max(50), freeThresholdPence: z.number().int().min(0).nullable() }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the delivery options.");
  for (const r of parsed.data.rates)
    if (r.max_weight_g != null && r.max_weight_g <= r.min_weight_g) return fail(`"${r.name}": the heaviest weight must be more than the lightest.`);

  const { db, viewer } = await staffDb();
  const { data: existing } = await db.from("shipping_rates").select("id");
  const keep = new Set(parsed.data.rates.map((r) => r.id).filter(Boolean));
  const removed = (existing ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (removed.length) {
    // Rates used by old orders can't be deleted, so switch those off instead.
    const { error } = await db.from("shipping_rates").delete().in("id", removed);
    if (error) await db.from("shipping_rates").update({ is_active: false }).in("id", removed);
  }
  const rows = parsed.data.rates.map((r, i) => ({ ...r, id: r.id ?? crypto.randomUUID(), sort_order: i }));
  if (rows.length) {
    const { error } = await db.from("shipping_rates").upsert(rows);
    if (error) return fail("Couldn't save the delivery options.");
  }
  await db.from("store_settings").update({ free_shipping_threshold_pence: parsed.data.freeThresholdPence, updated_at: new Date().toISOString() }).eq("id", 1);
  await audit(db, viewer.id, "shipping.update", "shipping_rates", null, { count: rows.length, free: parsed.data.freeThresholdPence });
  revalidatePath("/admin/shipping");
  revalidatePath("/", "layout");
  return ok(undefined, "Delivery options saved.");
}

const settingsSchema = z.object({
  collection_enabled: z.boolean(),
  collection_address: z.string().trim().max(500).nullable(),
  collection_hours: z.string().trim().max(200).nullable(),
  invoice_terms_days: z.number().int().min(0).max(120),
  bank_details: z.string().trim().max(1000).nullable(),
  low_stock_email: z.union([z.email(), z.literal("")]).nullable(),
  announcement: z.string().trim().max(200).nullable(),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(field === "low_stock_email" ? "Please enter a valid email address for low stock alerts." : parsed.error.issues[0]?.message ?? "Please check the settings.");
  }
  const { db, viewer } = await ownerDb();
  const d = parsed.data;
  const row = {
    ...d,
    collection_address: d.collection_address || null,
    collection_hours: d.collection_hours || null,
    bank_details: d.bank_details || null,
    low_stock_email: d.low_stock_email || null,
    announcement: d.announcement || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("store_settings").update(row).eq("id", 1);
  if (error) return fail("Couldn't save the settings.");
  await audit(db, viewer.id, "settings.update", "store_settings", "1", row);
  revalidatePath("/", "layout");
  return ok(undefined, "Settings saved.");
}
