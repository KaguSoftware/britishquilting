import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimGuestOrders } from "@/lib/auth/claim-orders";
import { safeNext } from "@/lib/auth/helpers";

/** OAuth, magic link, sign-up confirmation and password recovery all land here with a PKCE ?code=. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_code") ?? searchParams.get("error");

  const fail = (reason: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    if (next !== "/account") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (providerError) return fail(providerError === "access_denied" ? "access_denied" : providerError);
  if (!code) return fail("missing_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.code ?? "otp_expired");

  await claimGuestOrders(data.user);
  return NextResponse.redirect(new URL(next, origin));
}
