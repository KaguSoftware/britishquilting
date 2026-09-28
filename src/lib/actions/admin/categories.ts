"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Please give the category a name").max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  image_url: z.string().trim().max(500).optional().nullable(),
  is_visible: z.boolean().default(true),
});

export type CategoryInput = z.input<typeof schema>;

function refresh() {
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details.");
  const { db, viewer } = await staffDb();
  const { id, ...c } = parsed.data;
  const slug = slugify(c.slug || c.name);
  const clash = await db.from("categories").select("id").eq("slug", slug).neq("id", id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (clash.data) return fail(`Another category already uses the web address "${slug}".`);
  const row = { ...c, slug, description: c.description || null, image_url: c.image_url || null };
  if (id) {
    const { error } = await db.from("categories").update(row).eq("id", id);
    if (error) return fail("Couldn't save the category.");
    await audit(db, viewer.id, "category.update", "category", id, { name: c.name });
    refresh();
    return ok({ id }, "Category saved.");
  }
  const { data: last } = await db.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db.from("categories").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 }).select("id").single();
  if (error) return fail("Couldn't create the category.");
  await audit(db, viewer.id, "category.create", "category", data.id, { name: c.name });
  refresh();
  return ok({ id: data.id }, "Category added.");
}

export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  if (!z.array(z.uuid()).safeParse(ids).success) return fail("Invalid order.");
  const { db, viewer } = await staffDb();
  await Promise.all(ids.map((id, i) => db.from("categories").update({ sort_order: i }).eq("id", id)));
  await audit(db, viewer.id, "category.reorder", "category", null, { ids });
  refresh();
  return ok(undefined, "Order saved.");
}

export async function deleteCategory(id: string): Promise<ActionResult<{ restore: Record<string, unknown>; productIds: string[] }>> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid category.");
  const { db, viewer } = await staffDb();
  const { data: row } = await db.from("categories").select("*").eq("id", id).maybeSingle();
  if (!row) return fail("That category no longer exists.");
  const { data: prods } = await db.from("products").select("id").eq("category_id", id);
  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) return fail("Couldn't delete the category.");
  await audit(db, viewer.id, "category.delete", "category", id, { name: row.name });
  refresh();
  return ok({ restore: row, productIds: (prods ?? []).map((p) => p.id) }, `"${row.name}" deleted.`);
}

/** Undo for deleteCategory: put the row back and re-attach its products. */
export async function restoreCategory(row: Record<string, unknown>, productIds: string[]): Promise<ActionResult> {
  const { db, viewer } = await staffDb();
  if (!z.uuid().safeParse(row.id).success) return fail("Invalid category.");
  const keys = ["id", "slug", "name", "description", "image_url", "parent_id", "sort_order", "is_visible"];
  const clean = Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));
  const { error } = await db.from("categories").insert(clean);
  if (error) return fail("Couldn't bring the category back.");
  if (productIds.length) await db.from("products").update({ category_id: row.id }).in("id", productIds);
  await audit(db, viewer.id, "category.restore", "category", String(row.id));
  refresh();
  return ok();
}
