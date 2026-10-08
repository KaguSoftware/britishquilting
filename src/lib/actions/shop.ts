"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/catalog";
import { rateLimit } from "@/lib/rate-limit";

export type FormState = { ok: boolean; message: string } | null;

/* ───────────────────────── back-in-stock alerts */

const alertSchema = z.object({ productId: z.uuid(), variantId: z.uuid().nullable(), email: z.email().max(254) });

export async function requestStockAlert(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit("stock-alert", { limit: 20, windowSeconds: 3600 })))
    return { ok: false, message: "Too many requests. Please try again in a little while." };
  const parsed = alertSchema.safeParse({ productId: form.get("productId"), variantId: form.get("variantId") || null, email: form.get("email") });
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  const db = createAdminClient();
  const { data: product } = await db.from("products").select("id").eq("id", parsed.data.productId).eq("is_active", true).maybeSingle();
  if (!product) return { ok: false, message: "This fabric is no longer available." };
  const variantId = parsed.data.variantId;
  if (variantId) {
    const { data: variant } = await db.from("product_variants").select("id").eq("id", variantId).eq("product_id", product.id).eq("is_active", true).maybeSingle();
    if (!variant) return { ok: false, message: "This colour is no longer available." };
  }
  const { error } = await db
    .from("stock_alerts")
    .upsert(
      { product_id: product.id, variant_id: variantId, email: parsed.data.email.toLowerCase(), notified_at: null },
      { onConflict: "product_id,variant_id,email" },
    );
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  return { ok: true, message: "We'll email you the moment it's back on the bolt." };
}

/* ───────────────────────── reviews */

const reviewSchema = z.object({
  productId: z.uuid(),
  slug: z.string().max(200),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Please write at least a sentence.").max(3000),
  authorName: z.string().trim().min(1).max(80),
});

const PAID_STATUSES = ["paid", "processing", "shipped", "ready_for_collection", "collected", "delivered"];

export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Please sign in to leave a review." };
  const parsed = reviewSchema.safeParse({
    productId: form.get("productId"),
    slug: form.get("slug"),
    rating: form.get("rating"),
    title: form.get("title") || undefined,
    body: form.get("body"),
    authorName: form.get("authorName"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your review." };
  const d = parsed.data;
  const db = createAdminClient();

  const { data: bought } = await db
    .from("order_items")
    .select("id, orders!inner(user_id, status)")
    .eq("product_id", d.productId)
    .eq("is_swatch", false)
    .eq("orders.user_id", viewer.id)
    .in("orders.status", PAID_STATUSES)
    .limit(1);

  const { error } = await db.from("reviews").insert({
    product_id: d.productId,
    user_id: viewer.id,
    author_name: d.authorName,
    rating: d.rating,
    title: d.title ?? null,
    body: d.body,
    verified_purchase: Boolean(bought?.length),
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You've already reviewed this fabric. Thank you." };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  revalidatePath(`/product/${d.slug}`);
  return { ok: true, message: "Thank you. Your review will appear once we've read it." };
}

/* ───────────────────────── order tracking */

const trackSchema = z.object({
  number: z.string().trim().regex(/^#?\s*\d{1,10}$/),
  email: z.email().max(254),
});

export type TrackResult =
  | { ok: false; message: string }
  | {
      ok: true;
      order: {
        number: number;
        status: string;
        fulfilment: "delivery" | "collection";
        createdAt: string;
        paidAt: string | null;
        events: { kind: string; message: string | null; createdAt: string }[];
        shipments: { carrier: string; trackingNumber: string; trackingUrl: string | null; shippedAt: string }[];
      };
    }
  | null;

const GENERIC = "We couldn't find an order matching those details. Please check your order number and the email you used at checkout.";

export async function trackOrder(_: TrackResult, form: FormData): Promise<TrackResult> {
  if (!(await rateLimit("track-order", { limit: 20, windowSeconds: 600 })))
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  const parsed = trackSchema.safeParse({ number: form.get("number"), email: form.get("email") });
  if (!parsed.success) return { ok: false, message: GENERIC };
  const number = Number(parsed.data.number.replace(/\D/g, ""));
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, number, status, fulfilment, created_at, paid_at, email")
    .eq("number", number)
    .ilike("email", parsed.data.email.trim())
    .maybeSingle();
  // Small constant delay blunts enumeration without punishing real customers.
  await new Promise((r) => setTimeout(r, 400));
  if (!order || String(order.email).toLowerCase() !== parsed.data.email.trim().toLowerCase()) return { ok: false, message: GENERIC };

  const [{ data: events }, { data: shipments }] = await Promise.all([
    db.from("order_events").select("kind, message, created_at").eq("order_id", order.id).eq("visible_to_customer", true).order("created_at"),
    db.from("shipments").select("carrier, tracking_number, tracking_url, shipped_at").eq("order_id", order.id).order("shipped_at"),
  ]);

  return {
    ok: true,
    order: {
      number: order.number,
      status: order.status,
      fulfilment: order.fulfilment,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      events: (events ?? []).map((e) => ({ kind: e.kind, message: e.message, createdAt: e.created_at })),
      shipments: (shipments ?? []).map((s) => ({ carrier: s.carrier, trackingNumber: s.tracking_number, trackingUrl: s.tracking_url, shippedAt: s.shipped_at })),
    },
  };
}

/* ───────────────────────── contact */

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(100),
  email: z.email("Please enter a valid email address.").max(254),
  phone: z.string().trim().max(40).optional(),
  topic: z.enum(["order", "product", "other"]).default("other"),
  message: z.string().trim().min(10, "Please add a little more detail.").max(5000),
  company: z.string().max(0).optional(), // honeypot
});

export async function sendContact(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit("contact", { limit: 5, windowSeconds: 3600 })))
    return { ok: false, message: "Too many messages sent. Please try again in a little while, or call us directly." };
  const parsed = contactSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone") || undefined,
    topic: form.get("topic") || undefined,
    message: form.get("message"),
    company: form.get("company") || undefined,
  });
  if (!parsed.success) {
    // Silently accept bot submissions caught by the honeypot.
    if (parsed.error.issues.some((i) => i.path[0] === "company")) return { ok: true, message: "Thank you. We'll be in touch shortly." };
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const text = `From: ${d.name} <${d.email}>${d.phone ? `\nPhone: ${d.phone}` : ""}\nTopic: ${d.topic}\n\n${d.message}`;
  try {
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "British Quilting <onboarding@resend.dev>",
        to: process.env.STAFF_NOTIFY_EMAIL ?? "mustafa@britishquilting.com",
        replyTo: d.email,
        subject: `Website enquiry (${d.topic}) from ${d.name}`,
        text,
      });
      if (error) throw error;
    } else {
      console.info("[contact] RESEND_API_KEY not set, message logged instead:\n" + text);
    }
  } catch (e) {
    console.error("sendContact", e);
    return { ok: false, message: "We couldn't send that just now. Please call or email us directly." };
  }
  return { ok: true, message: "Thank you. We'll reply within one working day." };
}
