import type { Metadata } from "next";
import { getStoreSettings, getViewer } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { stripeConfigured } from "@/lib/stripe";
import { paypalConfigured } from "@/lib/paypal";
import { CheckoutClient, type SavedAddress } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [viewer, settings] = await Promise.all([getViewer().catch(() => null), getStoreSettings().catch(() => null)]);

  let addresses: SavedAddress[] = [];
  let phone: string | null = null;
  if (viewer) {
    const supabase = await createClient();
    const [{ data }, { data: profile }] = await Promise.all([
      supabase
        .from("addresses")
        .select("id, label, full_name, line1, line2, city, county, postcode, phone, is_default")
        .eq("user_id", viewer.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("phone").eq("id", viewer.id).maybeSingle(),
    ]);
    addresses = (data ?? []) as SavedAddress[];
    phone = profile?.phone ?? null;
  }

  return (
    <CheckoutClient
      viewer={viewer ? { email: viewer.email ?? "", fullName: viewer.fullName, phone, isTrade: viewer.isTrade } : null}
      addresses={addresses}
      collection={
        settings?.collection_enabled ? { address: settings.collection_address ?? "London", hours: settings.collection_hours ?? null } : null
      }
      invoiceTermsDays={settings?.invoice_terms_days ?? 30}
      payments={{
        stripeKey: stripeConfigured() ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY! : null,
        paypalClientId: paypalConfigured() ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID! : null,
      }}
    />
  );
}
