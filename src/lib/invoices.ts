/** Manual invoices: shared types and maths for the editor (client) and the actions (server). */

export type ManualCustomer = {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  note: string | null;
};

export type InvoiceLine = {
  description: string;
  quantity: number;
  unit_price_pence: number;
};

export type BillTo = Omit<ManualCustomer, "id" | "note">;

export type ManualInvoice = {
  id: string;
  number: number;
  customer_id: string | null;
  bill_to: BillTo;
  items: InvoiceLine[];
  total_pence: number;
  vat_included_pence: number;
  issued_on: string;
  due_on: string | null;
  note: string | null;
  paid_at: string | null;
};

export const manualInvoiceNo = (n: number) => `INV-M${n}`;

export const lineAmount = (l: Pick<InvoiceLine, "quantity" | "unit_price_pence">) => Math.round(l.quantity * l.unit_price_pence);

export const invoiceTotal = (lines: Pick<InvoiceLine, "quantity" | "unit_price_pence">[]) => lines.reduce((s, l) => s + lineAmount(l), 0);

export function billToLines(b: Partial<BillTo> | null | undefined): string[] {
  if (!b) return [];
  return [b.full_name, b.company, b.line1, b.line2, b.city, b.county, b.postcode].filter((x): x is string => Boolean(x && x.trim()));
}

/** Digits and a leading plus only, for tel: links. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
