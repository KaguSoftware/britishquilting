import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Link guest orders placed with this email to the account.
 * Only runs once the email is confirmed, so nobody can claim orders
 * by signing up with someone else's address.
 */
export async function claimGuestOrders(user: Pick<User, "id" | "email" | "email_confirmed_at"> | null | undefined) {
  if (!user?.email || !user.email_confirmed_at) return 0;
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("orders")
      .update({ user_id: user.id })
      .is("user_id", null)
      .eq("email", user.email.toLowerCase())
      .select("id");
    if (error) {
      console.error("claimGuestOrders", error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (e) {
    console.error("claimGuestOrders", e);
    return 0;
  }
}
