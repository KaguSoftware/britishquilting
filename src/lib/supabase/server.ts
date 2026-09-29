import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/** Request-scoped client that acts as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS, only ever call it after authorising
 * the caller yourself (see requireStaff / order ownership checks).
 */
export function createAdminClient() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Plain anon-key client with no cookie access. Safe to call from inside a cache
 * scope (unstable_cache) that forbids cookies()/headers(); only for reads that are
 * genuinely public (catalog, journal), never per-viewer or auth-dependent data.
 */
export function createPublicClient() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
