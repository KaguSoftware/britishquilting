"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthError } from "@/lib/auth/helpers";

export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

/** Every action re-verifies the user with Supabase Auth; RLS then scopes the rows. */
async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const signedOut: FormState = { ok: false, message: "Your session has ended. Please sign in again." };
const str = (form: FormData, k: string) => {
  const v = form.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const optional = (max: number) =>
  z.string().max(max).transform((s) => (s === "" ? null : s));

const UK_POSTCODE = /^(GIR ?0AA|[A-PR-UWYZ]([0-9]{1,2}|[A-HK-Y][0-9]{1,2}|[0-9][A-HJKPS-UW]|[A-HK-Y][0-9][ABEHMNPRV-Y]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

function normalisePostcodeInput(raw: string) {
  const c = raw.replace(/\s+/g, "").toUpperCase();
  return c.length > 3 ? `${c.slice(0, -3)} ${c.slice(-3)}` : c;
}

const phone = z
  .string()
  .max(30)
  .refine((s) => s === "" || /^[+()\d\s-]{7,}$/.test(s), "Please enter a valid phone number.")
  .transform((s) => (s === "" ? null : s));

/* ─────────────── Profile */
export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  const parsed = z
    .object({ full_name: z.string().min(2, "Please enter your name.").max(120), phone, marketing_opt_in: z.boolean() })
    .safeParse({ full_name: str(form, "full_name"), phone: str(form, "phone"), marketing_opt_in: form.get("marketing_opt_in") === "on" });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { message: "We couldn't save your details. Please try again." };
  await supabase.auth.updateUser({ data: { full_name: parsed.data.full_name } });
  revalidatePath("/account", "layout");
  return { ok: true, message: "Your details have been saved." };
}

/* ─────────────── Password */
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  const parsed = z
    .object({
      password: z
        .string()
        .min(8, "Use at least 8 characters.")
        .max(72)
        .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Mix letters and at least one number."),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "reauthentication_needed")
      return { message: "For security, please sign out and back in, then change your password straight away." };
    return { message: friendlyAuthError(error) };
  }
  return { ok: true, message: "Password updated. Use it next time you sign in." };
}

/* ─────────────── Addresses */
const addressSchema = z.object({
  id: z.uuid().nullable(),
  label: optional(40),
  full_name: z.string().min(2, "Please enter the recipient's name.").max(120),
  line1: z.string().min(3, "Please enter the first line of the address.").max(160),
  line2: optional(160),
  city: z.string().min(2, "Please enter a town or city.").max(80),
  county: optional(80),
  postcode: z
    .string()
    .transform(normalisePostcodeInput)
    .refine((p) => UK_POSTCODE.test(p), "Please enter a valid UK postcode, for example SW1A 1AA."),
  phone,
  is_default: z.boolean(),
});

export async function saveAddress(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  const parsed = addressSchema.safeParse({
    id: str(form, "id") || null,
    label: str(form, "label"),
    full_name: str(form, "full_name"),
    line1: str(form, "line1"),
    line2: str(form, "line2"),
    city: str(form, "city"),
    county: str(form, "county"),
    postcode: str(form, "postcode"),
    phone: str(form, "phone"),
    is_default: form.get("is_default") === "on",
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { id, ...values } = parsed.data;

  // First address becomes the default automatically.
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const makeDefault = values.is_default || (count ?? 0) === 0 || (id !== null && (count ?? 0) === 1);
  if (makeDefault) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);

  const row = { ...values, is_default: makeDefault, country: "GB", user_id: user.id };
  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert(row);
  if (error) return { message: "We couldn't save that address. Please try again." };
  revalidatePath("/account", "layout");
  return { ok: true, message: id ? "Address updated." : "Address added." };
}

export async function deleteAddress(id: string): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  if (!z.uuid().safeParse(id).success) return { message: "Address not found." };
  const { data: removed, error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("is_default")
    .maybeSingle();
  if (error) return { message: "We couldn't remove that address. Please try again." };
  if (removed?.is_default) {
    const { data: nextDefault } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nextDefault) await supabase.from("addresses").update({ is_default: true }).eq("id", nextDefault.id);
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Address removed." };
}

export async function setDefaultAddress(id: string): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  if (!z.uuid().safeParse(id).success) return { message: "Address not found." };
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { message: "We couldn't update your default address." };
  revalidatePath("/account", "layout");
  return { ok: true, message: "Default address updated." };
}

/* ─────────────── Wishlist */
export async function removeFromWishlist(productId: string): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;
  if (!z.uuid().safeParse(productId).success) return { message: "Item not found." };
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return { message: "We couldn't update your wishlist." };
  revalidatePath("/account/wishlist");
  return { ok: true, message: "Removed from your wishlist." };
}

/* ─────────────── Trade application */
export async function applyForTrade(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  if (!user) return signedOut;

  const { data: profile } = await supabase.from("profiles").select("trade_status").eq("id", user.id).maybeSingle();
  if (profile?.trade_status === "approved") return { message: "Your trade account is already active." };
  const { data: open } = await supabase.from("trade_applications").select("id").eq("user_id", user.id).eq("status", "pending").limit(1);
  if (profile?.trade_status === "pending" || (open?.length ?? 0) > 0) return { message: "Your application is already with us. We'll be in touch shortly." };

  const parsed = z
    .object({
      company_name: z.string().min(2, "Please enter your company or trading name.").max(160),
      business_type: z.string().min(1, "Please choose the option closest to your business.").max(60),
      vat_number: z
        .string()
        .max(20)
        .refine((s) => s === "" || /^(GB)?\s?\d{3}\s?\d{4}\s?\d{2}(\s?\d{3})?$/i.test(s), "That doesn't look like a UK VAT number, for example GB 123 4567 89.")
        .transform((s) => (s === "" ? null : s.toUpperCase().replace(/\s+/g, ""))),
      company_number: z
        .string()
        .max(10)
        .refine((s) => s === "" || /^([A-Z]{2}\d{6}|\d{8})$/i.test(s.replace(/\s+/g, "")), "Company numbers are 8 characters, for example 01234567.")
        .transform((s) => (s === "" ? null : s.toUpperCase().replace(/\s+/g, ""))),
      website: z
        .string()
        .max(200)
        .transform((s) => (s === "" ? null : /^https?:\/\//i.test(s) ? s : `https://${s}`))
        .refine((s) => s === null || z.url().safeParse(s).success, "Please enter a valid website address."),
      message: optional(2000),
    })
    .safeParse({
      company_name: str(form, "company_name"),
      business_type: str(form, "business_type"),
      vat_number: str(form, "vat_number"),
      company_number: str(form, "company_number"),
      website: str(form, "website"),
      message: str(form, "message"),
    });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { error } = await supabase.from("trade_applications").insert({ ...parsed.data, user_id: user.id });
  if (error) return { message: "We couldn't send your application. Please try again." };
  // trade_status is trigger-guarded (staff only); the pending state is read from trade_applications instead.
  await supabase
    .from("profiles")
    .update({ company_name: parsed.data.company_name, vat_number: parsed.data.vat_number })
    .eq("id", user.id);
  revalidatePath("/account", "layout");
  return { ok: true, message: "Application received. We review every account personally, usually within one working day." };
}

export async function toggleWishlist(productId: string, save: boolean): Promise<{ ok?: boolean; message?: string; saved?: boolean }> {
  const { supabase, user } = await authed();
  if (!user) return { ok: false, message: "Please sign in to save items." };
  if (!z.uuid().safeParse(productId).success) return { message: "Item not found." };
  const { error } = save
    ? await supabase.from("wishlist_items").upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true })
    : await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return { message: "We couldn't update your wishlist." };
  revalidatePath("/account/wishlist");
  revalidatePath("/account");
  return { ok: true, saved: save, message: save ? "Saved to your wishlist." : "Removed from your wishlist." };
}
