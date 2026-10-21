import { NextResponse, type NextRequest } from "next/server";
import { isProductAddress, resolveProductAddress } from "@/lib/product-address";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Product pages stream, so a redirect from the page itself arrives as an in-page refresh. Sending old product
  // addresses on here gives browsers and search engines a real 308. Current addresses (lin5) skip the lookup.
  const product = request.nextUrl.pathname.match(/^\/product\/([^/]+)\/?$/);
  if (product && !isProductAddress(product[1])) {
    const target = await resolveProductAddress(product[1]).catch(() => null);
    if (target) {
      const url = new URL(target, request.nextUrl.origin);
      // Keep anything else in the link (?colour=..., tracking tags).
      for (const [k, v] of request.nextUrl.searchParams) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      return NextResponse.redirect(url, 308);
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|glb|ktx2)$).*)",
  ],
};
