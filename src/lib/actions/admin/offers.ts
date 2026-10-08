"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

/**
 * A special offer is a product whose price has been lowered, with the old price kept as its
 * was price (compare_at_pence). The shop lists every such product under Special Offers and
 * charges the lowered price at checkout. Ending the offer puts the old price back.
 */

function refresh(slug?: string) {
  revalidatePath("/admin/offers");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  revalidateTag("products", { expire: 0 });
  if (slug) revalidateTag(`product:${slug}`, { expire: 0 });
}

const onOffer = (p: { price_pence: number; compare_at_pence: number | null }) => p.compare_at_pence != null && p.compare_at_pence > p.price_pence;

async function load(id: string) {
  const { db, viewer } = await staffDb();
  const { data } = await db.from("products").select("id, slug, name, price_pence, compare_at_pence").eq("id", id).maybeSingle();
  return { db, viewer, product: data as { id: string; slug: string; name: string; price_pence: number; compare_at_pence: number | null } | null };
}

/** Starts an offer on a product, or changes the offer price of one already on offer. */
export async function saveOffer(input: { productId: string; pricePence: number }): Promise<ActionResult> {
  const parsed = z.object({ productId: z.uuid(), pricePence: z.number().int().min(1, "The offer price must be more than £0") }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the offer.");
  const { db, viewer, product } = await load(parsed.data.productId);
  if (!product) return fail("That product has been deleted.");

  const was = onOffer(product) ? product.compare_at_pence! : product.price_pence;
  if (parsed.data.pricePence >= was) return fail("The offer price must be lower than the normal price.");

  const { error } = await db.from("products").update({ price_pence: parsed.data.pricePence, compare_at_pence: was }).eq("id", product.id);
  if (error) return fail("Couldn't save the offer. Please try again.");
  await audit(db, viewer.id, onOffer(product) ? "offer.update" : "offer.create", "product", product.id, { was_pence: was, price_pence: parsed.data.pricePence });
  refresh(product.slug);
  return ok(undefined, onOffer(product) ? "Offer price changed." : `${product.name} is now on offer.`);
}

/** Ends an offer: the product goes back to its normal price. Hands back the offer price for Undo. */
export async function endOffer(productId: string): Promise<ActionResult<{ pricePence: number }>> {
  if (!z.uuid().safeParse(productId).success) return fail("Invalid product.");
  const { db, viewer, product } = await load(productId);
  if (!product) return fail("That product has been deleted.");
  if (!onOffer(product)) return fail("That product isn't on offer any more.");

  const { error } = await db.from("products").update({ price_pence: product.compare_at_pence, compare_at_pence: null }).eq("id", product.id);
  if (error) return fail("Couldn't end the offer. Please try again.");
  await audit(db, viewer.id, "offer.end", "product", product.id, { was_pence: product.compare_at_pence, price_pence: product.price_pence });
  refresh(product.slug);
  return ok({ pricePence: product.price_pence }, `${product.name} is back to its normal price.`);
}
