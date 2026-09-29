import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

/** Best-effort caller IP from proxy headers, for bucketing anonymous requests. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

type RateLimitOptions = {
  /** How many requests are allowed within the window. */
  limit: number;
  windowSeconds: number;
  /** Defaults to the caller's IP. */
  identifier?: string;
};

/**
 * Postgres-backed fixed-window rate limit (see check_rate_limit in supabase/migrations).
 * Returns true when the request should proceed. Fails open on any infra error, a Supabase
 * hiccup should never be the reason a real customer can't get in touch or track an order.
 */
export async function rateLimit(bucket: string, { limit, windowSeconds, identifier }: RateLimitOptions): Promise<boolean> {
  try {
    const id = identifier ?? (await clientIp());
    const db = createAdminClient();
    const { data, error } = await db.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_identifier: id,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return Boolean(data);
  } catch (e) {
    console.error(`rateLimit(${bucket})`, e);
    return true;
  }
}
