/**
 * The database refuses an email or phone number another customer already has
 * (supabase/migrations/20261108140000_customer_unique_contact.sql) with the message
 * customer_contact_taken:<email|phone>:<cid>. Turns that into something to show; null for any other error.
 */
export function contactTakenMessage(error: { message?: string } | null | undefined, opts: { showCid?: boolean } = {}): string | null {
  const m = error?.message?.match(/customer_contact_taken:(email|phone):(\d+)/);
  if (!m) return null;
  const what = m[1] === "email" ? "email address" : "phone number";
  return opts.showCid
    ? `That ${what} already belongs to customer CID-${m[2]}. Each customer needs their own ${what}.`
    : `That ${what} is already in use on another account.`;
}
