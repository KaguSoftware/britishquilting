/** Companies: shared types and helpers for the admin (client) and the actions (server). */
import type { AltAddress, BillTo } from "@/lib/invoices";

export type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  company_number: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  note: string | null;
} & AltAddress;

export const COMPANY_COLS =
  "id, name, email, phone, vat_number, company_number, line1, line2, city, county, postcode, alt_line1, alt_line2, alt_city, alt_county, alt_postcode, note";

/** The first address as lines (town, county and postcode each on their own line). */
export function companyAddressLines(c: Partial<Company> | null | undefined): string[] {
  if (!c) return [];
  return [c.line1, c.line2, c.city, c.county, c.postcode].filter((x): x is string => Boolean(x && x.trim()));
}

/** A company as copied onto an invoice or delivery note: the company name takes the name line. */
export function companyBillTo(c: Company): BillTo {
  return {
    number: null,
    full_name: c.name,
    company: null,
    email: c.email,
    phone: c.phone,
    line1: c.line1,
    line2: c.line2,
    city: c.city,
    county: c.county,
    postcode: c.postcode,
  };
}

/** Someone linked to a company: a customer added by hand, or a website account. */
export type CompanyMember = { kind: "manual" | "account"; id: string; cid: number | null; name: string; email: string | null; phone: string | null };
