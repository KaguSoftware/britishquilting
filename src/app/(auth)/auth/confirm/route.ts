import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { claimGuestOrders } from "@/lib/auth/claim-orders";
import { safeNext } from "@/lib/auth/helpers";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Email template links of the form /auth/confirm?token_hash=...&type=...&next=... */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"));

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await claimGuestOrders(data.user);
      return NextResponse.redirect(new URL(next, origin));
    }
    const url = new URL(type === "recovery" ? "/forgot-password" : "/login", origin);
    url.searchParams.set("error", error.code ?? "otp_expired");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/login?error=otp_expired", origin));
}
