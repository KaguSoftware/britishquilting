"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendTradeDecision } from "@/lib/email";
import { audit, ownerDb, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

/* ───────────────────────── Trade applications */

export async function decideTrade(applicationId: string, approve: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(applicationId).success) return fail("Invalid application.");
  const { db, viewer } = await staffDb();
  const { data: app } = await db.from("trade_applications").select("*").eq("id", applicationId).maybeSingle();
  if (!app) return fail("That application no longer exists.");
  const status = approve ? "approved" : "rejected";

  const { error } = await db
    .from("trade_applications")
    .update({ status, reviewed_by: viewer.id, reviewed_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) return fail("Couldn't save the decision.");

  const { data: profile } = await db.from("profiles").select("role").eq("id", app.user_id).maybeSingle();
  const update: Record<string, unknown> = { trade_status: status };
  if (approve) {
    update.company_name = app.company_name;
    if (app.vat_number) update.vat_number = app.vat_number;
    if (profile?.role === "customer") update.role = "trade";
  } else if (profile?.role === "trade") {
    update.role = "customer";
  }
  const { error: pErr } = await db.from("profiles").update(update).eq("id", app.user_id);
  if (pErr) return fail("Saved the decision, but couldn't update their account. Please try again.");

  try {
    await sendTradeDecision(app.user_id, approve);
  } catch (e) {
    console.error("trade email", e);
  }
  await audit(db, viewer.id, approve ? "trade.approve" : "trade.reject", "trade_application", applicationId, { company: app.company_name });
  revalidatePath("/admin", "layout");
  return ok(undefined, approve ? `${app.company_name} approved. They've been emailed.` : `${app.company_name} declined. They've been emailed.`);
}

/* ───────────────────────── Staff (owner only) */

export async function promoteToStaff(email: string): Promise<ActionResult> {
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return fail("Please enter a valid email address.");
  const { db, viewer } = await ownerDb();
  const { data: profile } = await db.from("profiles").select("id, role, full_name").eq("email", parsed.data).maybeSingle();
  if (!profile) return fail("There's no account with that email yet. Ask them to create an account on the shop first, then try again.");
  if (profile.role === "staff" || profile.role === "owner") return fail("They already have access to the back office.");
  const { error } = await db.from("profiles").update({ role: "staff" }).eq("id", profile.id);
  if (error) return fail("Couldn't give them access. Please try again.");
  await audit(db, viewer.id, "staff.promote", "profile", profile.id, { email: parsed.data, from: profile.role });
  revalidatePath("/admin/staff");
  return ok(undefined, `${profile.full_name || parsed.data} can now use the back office.`);
}

export async function removeStaff(profileId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(profileId).success) return fail("Invalid person.");
  const { db, viewer } = await ownerDb();
  if (profileId === viewer.id) return fail("You can't remove your own access.");
  const { data: profile } = await db.from("profiles").select("role, trade_status").eq("id", profileId).maybeSingle();
  if (!profile) return fail("That person no longer exists.");
  if (profile.role === "owner") return fail("Owners can't be removed here.");
  const role = profile.trade_status === "approved" ? "trade" : "customer";
  const { error } = await db.from("profiles").update({ role }).eq("id", profileId);
  if (error) return fail("Couldn't remove their access.");
  await audit(db, viewer.id, "staff.remove", "profile", profileId);
  revalidatePath("/admin/staff");
  return ok(undefined, "Access removed.");
}

/** Undo for removeStaff. */
export async function restoreStaff(profileId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(profileId).success) return fail("Invalid person.");
  const { db, viewer } = await ownerDb();
  const { error } = await db.from("profiles").update({ role: "staff" }).eq("id", profileId);
  if (error) return fail("Couldn't restore their access.");
  await audit(db, viewer.id, "staff.promote", "profile", profileId, { undo: true });
  revalidatePath("/admin/staff");
  return ok();
}
