import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManualCustomer } from "@/lib/invoices";

export const CUSTOMER_COLS = "id, full_name, company, email, phone, line1, line2, city, county, postcode, note";

/** Everything the invoice editor needs besides the invoice itself. */
export async function editorData(db: SupabaseClient) {
  const [{ data: customers }, { data: settings }] = await Promise.all([
    db.from("manual_customers").select(CUSTOMER_COLS).order("full_name").limit(1000),
    db.from("finance_settings").select("vat_rate").maybeSingle(),
  ]);
  return {
    customers: (customers ?? []) as ManualCustomer[],
    vatRate: Number(settings?.vat_rate ?? 20),
  };
}
