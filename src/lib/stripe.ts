import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Stripe is usable only when both the secret and publishable keys are configured. */
export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Server Stripe client, or null when keys are missing (callers must degrade gracefully). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "British Quilting" }, maxNetworkRetries: 2 });
  return client;
}
