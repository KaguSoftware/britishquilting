import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_COLS, type Company } from "@/lib/companies";
import { CUSTOMER_COLS } from "@/lib/data/invoices";
import { billToLines, type BillTo, type InvoiceLine, type ManualCustomer } from "@/lib/invoices";

/** An invoice as a delivery note needs it: its lines, who it's for and their addresses for the Deliver To boxes. */
export type NoteInvoice = {
  id: string;
  number: number;
  customer_id: string | null;
  company_id: string | null;
  bill_to: BillTo;
  items: InvoiceLine[];
  total_pence: number;
  issued_on: string;
  deliver_to: string | null;
  po_number: string | null;
  /** Ready-made addresses to drop into a place: the invoice's own Deliver To, the customer's or company's two addresses. */
  addresses: { label: string; text: string }[];
};

const lines = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => Boolean(x && x.trim())).join("\n");

export async function loadNoteInvoice(db: SupabaseClient, id: string): Promise<NoteInvoice | null> {
  const { data: inv } = await db
    .from("invoices")
    .select("id, number, customer_id, company_id, bill_to, items, total_pence, issued_on, deliver_to, po_number")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return null;
  const [{ data: customer }, { data: company }] = await Promise.all([
    inv.customer_id ? db.from("manual_customers").select(CUSTOMER_COLS).eq("id", inv.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    inv.company_id ? db.from("companies").select(COMPANY_COLS).eq("id", inv.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const who = (customer ?? company) as (ManualCustomer | Company) | null;
  const name = customer ? (customer as ManualCustomer).full_name : company ? (company as Company).name : (inv.bill_to as BillTo).full_name;
  const addresses: { label: string; text: string }[] = [];
  if (inv.deliver_to?.trim()) addresses.push({ label: "Invoice's Deliver To", text: inv.deliver_to.trim() });
  if (who?.line1) addresses.push({ label: "Address", text: lines(name, who.line1, who.line2, who.city, who.county, who.postcode) });
  else if (!who && billToLines(inv.bill_to as BillTo).length > 1) addresses.push({ label: "Invoice address", text: billToLines(inv.bill_to as BillTo).join("\n") });
  if (who?.alt_line1) addresses.push({ label: "Second address", text: lines(name, who.alt_line1, who.alt_line2, who.alt_city, who.alt_county, who.alt_postcode) });
  return { ...(inv as Omit<NoteInvoice, "addresses">), addresses };
}
