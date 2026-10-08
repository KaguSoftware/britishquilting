"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, ownerDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

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
  const { data: profile } = await db.from("profiles").select("role").eq("id", profileId).maybeSingle();
  if (!profile) return fail("That person no longer exists.");
  if (profile.role === "owner") return fail("Owners can't be removed here.");
  const { error } = await db.from("profiles").update({ role: "customer" }).eq("id", profileId);
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
