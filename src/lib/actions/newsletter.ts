"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { sendWelcomeNewsletter } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export type NewsletterState = { ok: boolean; message: string } | null;

const schema = z.object({ email: z.email().max(254), source: z.string().max(40).optional() });

export async function subscribe(_: NewsletterState, form: FormData): Promise<NewsletterState> {
  if (!(await rateLimit("newsletter", { limit: 5, windowSeconds: 3600 })))
    return { ok: false, message: "Too many attempts. Please try again in a little while." };
  const parsed = schema.safeParse({ email: form.get("email"), source: form.get("source") ?? "footer" });
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  const db = createAdminClient();
  const email = parsed.data.email.toLowerCase();
  // Only brand new subscribers get the welcome email, never a repeat sign-up.
  const { data: existing } = await db.from("newsletter_subscribers").select("id").eq("email", email).maybeSingle();
  const { error } = await db
    .from("newsletter_subscribers")
    .upsert({ email, source: parsed.data.source, unsubscribed_at: null }, { onConflict: "email" });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  if (!existing) await sendWelcomeNewsletter(email).catch((e) => console.error("welcome email", e));
  return { ok: true, message: "Thank you, you're on the list." };
}
