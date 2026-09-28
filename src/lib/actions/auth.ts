"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { claimGuestOrders } from "@/lib/auth/claim-orders";
import { friendlyAuthError, safeNext } from "@/lib/auth/helpers";
import { siteUrl } from "@/lib/utils";

export type AuthState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  email?: string;
} | null;

async function origin() {
  const h = await headers();
  const o = h.get("origin");
  if (o) return o;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  return siteUrl;
}

const email = z.email("Please enter a valid email address.").max(254).transform((s) => s.trim().toLowerCase());
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Please keep it under 72 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Mix letters and at least one number.");

function callbackUrl(base: string, next: string) {
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

/* ─────────────── Email + password sign in */
export async function signInWithPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Please enter your password.") })
    .safeParse({ email: String(form.get("email") ?? "").trim(), password: form.get("password") });
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, email: typedEmail };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: friendlyAuthError(error), email: typedEmail };

  await claimGuestOrders(data.user);
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}

/* ─────────────── Create account */
export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Please tell us your name.").max(120),
      email,
      password,
      marketing: z.boolean(),
    })
    .safeParse({
      fullName: form.get("fullName"),
      email: String(form.get("email") ?? "").trim(),
      password: form.get("password"),
      marketing: form.get("marketing") === "on",
    });
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, email: typedEmail };

  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: callbackUrl(await origin(), next),
    },
  });
  if (error) return { message: friendlyAuthError(error), email: typedEmail };

  // Supabase hides existing accounts behind an empty identities list.
  if (data.user && data.user.identities?.length === 0) {
    return { message: friendlyAuthError({ code: "user_already_exists" }), email: typedEmail };
  }

  if (data.user && parsed.data.marketing) {
    await createAdminClient().from("profiles").update({ marketing_opt_in: true }).eq("id", data.user.id);
  }

  if (data.session) {
    await claimGuestOrders(data.user);
    revalidatePath("/", "layout");
    redirect(next);
  }
  return { ok: true, email: parsed.data.email, message: "Check your inbox to confirm your email address." };
}

/* ─────────────── Magic link */
export async function sendMagicLink(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(String(form.get("email") ?? "").trim());
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: { email: ["Please enter a valid email address."] }, email: typedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: callbackUrl(await origin(), safeNext(form.get("next"))), shouldCreateUser: true },
  });
  if (error) return { message: friendlyAuthError(error), email: typedEmail };
  return { ok: true, email: parsed.data, message: "We've emailed you a secure sign-in link." };
}

/* ─────────────── Google / Apple */
export async function signInWithProvider(form: FormData) {
  const provider = form.get("provider") === "apple" ? "apple" : "google";
  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(await origin(), next) },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.code ?? "provider_disabled")}&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

/* ─────────────── Forgotten password */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(String(form.get("email") ?? "").trim());
  const typedEmail = String(form.get("email") ?? "");
  if (!parsed.success) return { fieldErrors: { email: ["Please enter a valid email address."] }, email: typedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callbackUrl(await origin(), "/reset-password"),
  });
  // Rate limits are worth surfacing; anything else stays vague so emails can't be enumerated.
  if (error && (error.status === 429 || error.code?.includes("rate_limit"))) return { message: friendlyAuthError(error), email: typedEmail };
  return { ok: true, email: parsed.data, message: "If an account exists for that address, a reset link is on its way." };
}

/* ─────────────── Choose a new password (after recovery link) */
export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: friendlyAuthError(error) };
  revalidatePath("/", "layout");
  redirect("/account?password=updated");
}

/* ─────────────── Sign out */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?signed-out=1");
}
