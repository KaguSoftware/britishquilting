"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

/* ───────────────────────── Discounts */

const discountSchema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .trim()
      .min(3, "The code needs at least 3 letters")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Codes can only use letters, numbers, dashes and underscores"),
    kind: z.enum(["percent", "fixed", "free_shipping"]),
    value: z.number().int().min(0),
    min_subtotal_pence: z.number().int().min(0).default(0),
    max_uses: z.number().int().min(1).nullable(),
    once_per_customer: z.boolean(),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    is_active: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "percent" && (d.value < 1 || d.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "The percentage must be between 1 and 100" });
    if (d.kind === "fixed" && d.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Please enter how much money comes off" });
    if (d.starts_at && d.ends_at && d.ends_at < d.starts_at) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end date is before the start date" });
  });

export type DiscountInput = z.input<typeof discountSchema>;

export async function saveDiscount(input: DiscountInput): Promise<ActionResult<{ id: string }>> {
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the details.");
  const { db, viewer } = await staffDb();
  const { id, ...d } = parsed.data;
  const row = { ...d, code: d.code.toUpperCase(), value: d.kind === "free_shipping" ? 0 : d.value };
  const { data: clash } = await db.from("discount_codes").select("id").eq("code", row.code).maybeSingle();
  if (clash && clash.id !== id) return fail(`There's already a code called ${row.code}.`);
  const res = id
    ? await db.from("discount_codes").update(row).eq("id", id).select("id").single()
    : await db.from("discount_codes").insert(row).select("id").single();
  if (res.error) return fail("Couldn't save the discount.");
  await audit(db, viewer.id, id ? "discount.update" : "discount.create", "discount", res.data.id, { code: row.code });
  revalidatePath("/admin/discounts");
  return ok({ id: res.data.id }, id ? "Discount saved." : `${row.code} is ready to use.`);
}

export async function setDiscountActive(id: string, active: boolean): Promise<ActionResult> {
  const { db, viewer } = await staffDb();
  const { error } = await db.from("discount_codes").update({ is_active: active }).eq("id", id);
  if (error) return fail("Couldn't update the discount.");
  await audit(db, viewer.id, active ? "discount.enable" : "discount.disable", "discount", id);
  revalidatePath("/admin/discounts");
  return ok(undefined, active ? "Code switched on." : "Code switched off.");
}

export async function deleteDiscount(id: string): Promise<ActionResult<{ row: Record<string, unknown> }>> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid discount.");
  const { db, viewer } = await staffDb();
  const { data: row } = await db.from("discount_codes").select("*").eq("id", id).maybeSingle();
  if (!row) return fail("That code no longer exists.");
  const { error } = await db.from("discount_codes").delete().eq("id", id);
  if (error) return fail("Couldn't delete the code. Try switching it off instead.");
  await audit(db, viewer.id, "discount.delete", "discount", id, { code: row.code });
  revalidatePath("/admin/discounts");
  return ok({ row }, `${row.code} deleted.`);
}

export async function restoreDiscount(row: Record<string, unknown>): Promise<ActionResult> {
  const { db, viewer } = await staffDb();
  const keys = ["id", "code", "kind", "value", "min_subtotal_pence", "max_uses", "uses", "once_per_customer", "starts_at", "ends_at", "is_active", "created_at"];
  const clean = Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));
  const { error } = await db.from("discount_codes").insert(clean);
  if (error) return fail("Couldn't bring the code back.");
  await audit(db, viewer.id, "discount.restore", "discount", String(row.id));
  revalidatePath("/admin/discounts");
  return ok();
}

/* ───────────────────────── Reviews */

export async function setReviewStatus(id: string, status: "pending" | "approved" | "rejected"): Promise<ActionResult<{ previous: string }>> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid review.");
  const { db, viewer } = await staffDb();
  const { data: r } = await db.from("reviews").select("status, product_id").eq("id", id).maybeSingle();
  if (!r) return fail("That review no longer exists.");
  const { error } = await db.from("reviews").update({ status }).eq("id", id);
  if (error) return fail("Couldn't update the review.");
  await audit(db, viewer.id, `review.${status}`, "review", id);
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return ok({ previous: r.status }, status === "approved" ? "Review is now live." : status === "rejected" ? "Review hidden." : "Moved back to waiting.");
}

export async function deleteReview(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid review.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("reviews").delete().eq("id", id);
  if (error) return fail("Couldn't delete the review.");
  await audit(db, viewer.id, "review.delete", "review", id);
  revalidatePath("/admin", "layout");
  return ok(undefined, "Review deleted.");
}

/* ───────────────────────── Newsletter */

export async function setSubscribed(id: string, subscribed: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid subscriber.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("newsletter_subscribers").update({ unsubscribed_at: subscribed ? null : new Date().toISOString() }).eq("id", id);
  if (error) return fail("Couldn't update the subscriber.");
  await audit(db, viewer.id, subscribed ? "newsletter.resubscribe" : "newsletter.unsubscribe", "newsletter_subscriber", id);
  revalidatePath("/admin/newsletter");
  return ok(undefined, subscribed ? "Subscribed again." : "Unsubscribed.");
}
