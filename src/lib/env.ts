import { z } from "zod";

/**
 * Validated environment variables, safe to import from client components. Only
 * NEXT_PUBLIC_* vars are guaranteed present here: everything else is a server-only
 * secret and stays optional so this schema never fails a browser bundle that only
 * ever sees the public ones inlined. Server code that truly requires a secret
 * (the service role key) should import `serverEnv` from `./env.server` instead.
 *
 * Each var is read by its own literal `process.env.X` expression, not the whole
 * `process.env` object, so Next.js can inline the NEXT_PUBLIC_* values into the
 * browser bundle at build time.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.url("NEXT_PUBLIC_SITE_URL must be a valid URL").optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1).optional(),

  // Server-only secrets: optional here on purpose, see the note above.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  PAYPAL_API_BASE: z.url("PAYPAL_API_BASE must be a valid URL").optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  STAFF_NOTIFY_EMAIL: z.email("STAFF_NOTIFY_EMAIL must be a valid email address").optional(),
});

// An unset var left blank in .env.local (e.g. `STRIPE_SECRET_KEY=`) reads back as "",
// not undefined. Treat that the same as unset for the optional vars below, matching the
// `Boolean(...)` "is this configured" checks that already exist at their call sites.
const orUndefined = (v: string | undefined) => (v ? v : undefined);

const raw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: orUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: orUndefined(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: orUndefined(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
  SUPABASE_SERVICE_ROLE_KEY: orUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
  STRIPE_SECRET_KEY: orUndefined(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: orUndefined(process.env.STRIPE_WEBHOOK_SECRET),
  PAYPAL_CLIENT_SECRET: orUndefined(process.env.PAYPAL_CLIENT_SECRET),
  PAYPAL_API_BASE: orUndefined(process.env.PAYPAL_API_BASE),
  RESEND_API_KEY: orUndefined(process.env.RESEND_API_KEY),
  EMAIL_FROM: orUndefined(process.env.EMAIL_FROM),
  STAFF_NOTIFY_EMAIL: orUndefined(process.env.STAFF_NOTIFY_EMAIL),
};

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  throw new Error(`Invalid or missing environment variables: ${problems}`);
}

export const env = parsed.data;
