import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Stripe is usable only when both the secret and publishable keys are configured. */
export function stripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Server Stripe client, or null when keys are missing (callers must degrade gracefully). */
export function getStripe(): Stripe | null {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "British Quilting" }, maxNetworkRetries: 2 });
  return client;
}
