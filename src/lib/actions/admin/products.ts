"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendBackInStock } from "@/lib/email";
import { slugify } from "@/lib/utils";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const num = (min = 0) => z.coerce.number().min(min);
const optNum = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable());
const optInt = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable());
const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

const imageSchema = z.object({
  id: z.string().optional(),
  storage_path: z.string().min(1).max(400),
  alt: z.string().max(300).nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
});

const productSchema = z
  .object({
    id: z.uuid(),
    isNew: z.boolean(),
    name: z.string().trim().min(2, "Please give the product a name").max(160),
    slug: z.string().trim().max(160).optional(),
    subtitle: optText(200),
    description: optText(8000),
    category_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
    sale_mode: z.enum(["metre", "roll", "unit"]),
    price_pence: z.coerce.number().int().min(0, "Please set a price"),
    trade_price_pence: optInt,
    compare_at_pence: optInt,
    min_length_m: optNum,
    length_step_m: optNum,
    max_length_m: optNum,
    roll_length_m: optNum,
    weight_g_per_unit: z.coerce.number().int().min(0).default(0),
    swatch_enabled: z.boolean(),
    swatch_price_pence: z.coerce.number().int().min(0).default(0),
    stock_qty: num(),
    low_stock_threshold: num(),
    track_stock: z.boolean(),
    colour: optText(80),
    colour_hex: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()),
    composition: optText(200),
    width_cm: optInt,
    weight_gsm: optInt,
    care: optText(1000),
    tags: z.array(z.string().trim().max(40)).max(30).default([]),
    is_active: z.boolean(),
    is_featured: z.boolean(),
    seo_title: optText(120),
    seo_description: optText(300),
    images: z.array(imageSchema).max(30),
  })
  .superRefine((p, ctx) => {
    if (p.sale_mode === "metre") {
      if (!p.min_length_m || p.min_length_m <= 0) ctx.addIssue({ code: "custom", path: ["min_length_m"], message: "Please set the smallest length someone can buy" });
      if (!p.length_step_m || p.length_step_m <= 0) ctx.addIssue({ code: "custom", path: ["length_step_m"], message: "Please set how much the length goes up by" });
      if (p.max_length_m != null && p.min_length_m != null && p.max_length_m < p.min_length_m)
        ctx.addIssue({ code: "custom", path: ["max_length_m"], message: "The longest length must be more than the shortest" });
    }
    if (p.sale_mode === "roll" && (!p.roll_length_m || p.roll_length_m <= 0))
      ctx.addIssue({ code: "custom", path: ["roll_length_m"], message: "Please say how many metres are on a roll" });
  });

export type ProductInput = z.input<typeof productSchema>;

/** When stock goes from nothing to something, tell the people who asked. */
async function notifyIfRestocked(db: SupabaseClient, productId: string, before: number, after: number) {
  if (!(before <= 0 && after > 0)) return 0;
  const { data: waiting } = await db.from("stock_alerts").select("id").eq("product_id", productId).is("notified_at", null);
  if (!waiting?.length) return 0;
  try {
    await sendBackInStock(productId);
    await db.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("product_id", productId).is("notified_at", null);
    return waiting.length;
  } catch (e) {
    console.error("back in stock email", e);
    return 0;
  }
}

function refresh(id?: string) {
  revalidatePath("/admin/products");
  if (id) revalidatePath(`/admin/products/${id}`);
  revalidatePath("/", "layout");
}

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the highlighted fields." };
  }
  const { db, viewer } = await staffDb();
  const { images, isNew, id, ...p } = parsed.data;
  const slug = slugify(p.slug || p.name);
  if (!slug) return fail("Please give the product a name");

  const { data: clash } = await db.from("products").select("id").eq("slug", slug).neq("id", id).maybeSingle();
  if (clash) return fail(`Another product already uses the web address "${slug}". Please change it.`);

  const row = {
    ...p,
    slug,
    // Keep the fields that don't apply to this way of selling tidy
    min_length_m: p.sale_mode === "metre" ? p.min_length_m : null,
    length_step_m: p.sale_mode === "metre" ? p.length_step_m : null,
    max_length_m: p.sale_mode === "metre" ? p.max_length_m : null,
    roll_length_m: p.sale_mode === "roll" ? p.roll_length_m : null,
  };

  let before = 0;
  if (isNew) {
    const { error } = await db.from("products").insert({ id, ...row });
    if (error) return fail("Couldn't create the product. Please try again.");
  } else {
    const { data: prev } = await db.from("products").select("stock_qty").eq("id", id).maybeSingle();
    if (!prev) return fail("This product no longer exists.");
    before = Number(prev.stock_qty);
    const { error } = await db.from("products").update(row).eq("id", id);
    if (error) return fail("Couldn't save the product. Please try again.");
  }

  // Sync photos: remove the ones taken away, then write the rest in order.
  const { data: existing } = await db.from("product_images").select("id, storage_path").eq("product_id", id);
  const keep = new Set(images.map((i) => i.storage_path));
  const gone = (existing ?? []).filter((e) => !keep.has(e.storage_path));
  if (gone.length) {
    await db.from("product_images").delete().in("id", gone.map((g) => g.id));
    const paths = gone.map((g) => g.storage_path).filter((path) => !path.startsWith("http") && !path.startsWith("/"));
    if (paths.length) await db.storage.from("products").remove(paths);
  }
  const byPath = new Map((existing ?? []).map((e) => [e.storage_path, e.id]));
  const rows = images.map((img, i) => ({
    id: byPath.get(img.storage_path) ?? crypto.randomUUID(),
    product_id: id,
    storage_path: img.storage_path,
    alt: img.alt || null,
    width: img.width ?? null,
    height: img.height ?? null,
    sort_order: i,
  }));
  if (rows.length) {
    const { error } = await db.from("product_images").upsert(rows);
    if (error) return fail("The product saved, but the photos didn't. Please try again.");
  }

  const notified = isNew ? 0 : await notifyIfRestocked(db, id, before, Number(p.stock_qty));
  await audit(db, viewer.id, isNew ? "product.create" : "product.update", "product", id, { name: p.name });
  refresh(id);
  return ok(
    { id },
    `${isNew ? "Product created" : "Saved"}${notified ? `. ${notified} ${notified === 1 ? "person has" : "people have"} been told it's back in stock` : ""}.`,
  );
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid product.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("products").update({ is_active: active }).eq("id", id);
  if (error) return fail("Couldn't update the product.");
  await audit(db, viewer.id, active ? "product.show" : "product.hide", "product", id);
  refresh(id);
  return ok(undefined, active ? "Now showing on the shop." : "Hidden from the shop.");
}

export async function updateStock(id: string, qty: number): Promise<ActionResult<{ previous: number }>> {
  const parsed = z.object({ id: z.uuid(), qty: z.number().min(0).max(1_000_000) }).safeParse({ id, qty });
  if (!parsed.success) return fail("Please enter a stock amount of 0 or more.");
  const { db, viewer } = await staffDb();
  const { data: prev } = await db.from("products").select("stock_qty").eq("id", id).maybeSingle();
  if (!prev) return fail("This product no longer exists.");
  const before = Number(prev.stock_qty);
  const { error } = await db.from("products").update({ stock_qty: qty }).eq("id", id);
  if (error) return fail("Couldn't update the stock.");
  const notified = await notifyIfRestocked(db, id, before, qty);
  await audit(db, viewer.id, "product.stock", "product", id, { from: before, to: qty });
  refresh(id);
  return ok({ previous: before }, `Stock updated${notified ? `. ${notified} waiting ${notified === 1 ? "customer" : "customers"} emailed` : ""}.`);
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid product.");
  const { db, viewer } = await staffDb();
  const { data: imgs } = await db.from("product_images").select("storage_path").eq("product_id", id);
  const { data: prod } = await db.from("products").select("name").eq("id", id).maybeSingle();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return fail("Couldn't delete the product. Try hiding it instead.");
  const paths = (imgs ?? []).map((i) => i.storage_path).filter((p) => !p.startsWith("http") && !p.startsWith("/"));
  if (paths.length) await db.storage.from("products").remove(paths);
  await audit(db, viewer.id, "product.delete", "product", id, { name: prod?.name });
  refresh();
  return ok(undefined, "Product deleted.");
}
