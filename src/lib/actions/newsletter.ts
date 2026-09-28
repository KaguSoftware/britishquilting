"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

export type NewsletterState = { ok: boolean; message: string } | null;

const schema = z.object({ email: z.email().max(254), source: z.string().max(40).optional() });

export async function subscribe(_: NewsletterState, form: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({ email: form.get("email"), source: form.get("source") ?? "footer" });
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  const db = createAdminClient();
  const { error } = await db
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data.email.toLowerCase(), source: parsed.data.source, unsubscribed_at: null }, { onConflict: "email" });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  return { ok: true, message: "Thank you, you're on the list." };
}
