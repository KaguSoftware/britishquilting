import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewer, type Viewer } from "@/lib/data/catalog";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The role as it stands in profiles right now. The JWT claim can be up to an hour stale, so a fresh promotion
 * would be refused and a fresh demotion let through. One primary-key read per request, only in the back office.
 */
const liveRole = cache(async (id: string) => {
  const { data } = await createAdminClient().from("profiles").select("role").eq("id", id).maybeSingle();
  return (data?.role ?? "customer") as Viewer["role"];
});

/** Signed-in staff member or owner, otherwise off to the login page. */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  const role = await liveRole(viewer.id);
  if (role !== "staff" && role !== "owner") redirect("/login?next=/admin&denied=1");
  return { ...viewer, role, isStaff: true };
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
