"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

/** The staff note on a website account. Kept apart from profiles so the customer can never read it. */
export async function saveAccountNote(profileId: string, note: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(profileId).success) return fail("Invalid customer.");
  const value = String(note ?? "").trim().slice(0, 1000);
  const { db, viewer } = await staffDb();
  const { error } = value
    ? await db.from("account_notes").upsert({ profile_id: profileId, note: value, updated_by: viewer.id, updated_at: new Date().toISOString() })
    : await db.from("account_notes").delete().eq("profile_id", profileId);
  if (error) return fail("Couldn't save the note.");
  await audit(db, viewer.id, "account.note", "profile", profileId);
  revalidatePath(`/admin/customers/${profileId}`);
  return ok(undefined, "Note saved.");
}
