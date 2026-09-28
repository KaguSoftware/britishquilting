import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewer, type Viewer } from "@/lib/data/catalog";
import { createAdminClient } from "@/lib/supabase/server";

/** Signed-in staff member or owner, otherwise off to the login page. */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isStaff) redirect("/login?next=/admin&denied=1");
  return viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireStaff();
  if (viewer.role !== "owner") redirect("/admin?owner-only=1");
  return viewer;
}

/** Authorise first, then hand back the service-role client. */
export async function staffDb() {
  const viewer = await requireStaff();
  return { viewer, db: createAdminClient() };
}

export async function ownerDb() {
  const viewer = await requireOwner();
  return { viewer, db: createAdminClient() };
}

export async function audit(
  db: SupabaseClient,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Record<string, unknown> | null,
) {
  await db.from("audit_log").insert({ actor_id: actorId, action, entity, entity_id: entityId ?? null, data: data ?? null });
}
