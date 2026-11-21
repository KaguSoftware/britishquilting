"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COMPANY_COLS, type Company, type CompanyMember } from "@/lib/companies";
import { parseCid } from "@/lib/invoices";
import { phoneProblem } from "@/lib/phone";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const companySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Please enter the company's name").max(160),
  email: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v == null || z.email().safeParse(v).success, "That email address doesn't look right"),
  phone: text(40).superRefine((v, ctx) => {
    const msg = phoneProblem(v);
    if (msg) ctx.addIssue({ code: "custom", message: msg });
  }),
  vat_number: text(40),
  company_number: text(40),
  line1: text(200),
  line2: text(200),
  city: text(100),
  county: text(100),
  postcode: text(12),
  alt_line1: text(200),
  alt_line2: text(200),
  alt_city: text(100),
  alt_county: text(100),
  alt_postcode: text(12),
  note: text(2000),
});

export type CompanyInput = z.input<typeof companySchema>;

const refresh = (id?: string) => {
  revalidatePath("/admin/customers", "layout");
  revalidatePath("/admin/invoices", "layout");
  if (id) revalidatePath(`/admin/customers/companies/${id}`);
};

const clean = (q: string) => String(q ?? "").slice(0, 100).replace(/[%,()\\*]/g, " ").trim();

/** The company search on the customer form, the invoice pad and the company picker. */
export async function searchCompanies(q: string): Promise<Company[]> {
  const { db } = await staffDb();
  const term = clean(q);
  let query = db.from("companies").select(COMPANY_COLS).order("name").limit(20);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,postcode.ilike.%${term}%`);
  return ((await query).data ?? []) as Company[];
}

export async function getCompany(id: string): Promise<Company | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { db } = await staffDb();
  const { data } = await db.from("companies").select(COMPANY_COLS).eq("id", id).maybeSingle();
  return (data ?? null) as Company | null;
}

export async function saveCompany(input: CompanyInput): Promise<ActionResult<Company>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the company's details.");
  const { db, viewer } = await staffDb();
  const { id, ...row } = parsed.data;
  if (id) {
    const { data, error } = await db.from("companies").update(row).eq("id", id).select(COMPANY_COLS).single();
    if (error || !data) return fail("Couldn't save the company. Please try again.");
    await audit(db, viewer.id, "company.update", "company", id);
    refresh(id);
    return ok(data as Company, "Company saved.");
  }
  const { data, error } = await db
    .from("companies")
    .insert({ ...row, created_by: viewer.id })
    .select(COMPANY_COLS)
    .single();
  if (error || !data) return fail("Couldn't add the company. Please try again.");
  await audit(db, viewer.id, "company.create", "company", data.id, { name: row.name });
  refresh();
  return ok(data as Company, "Company added.");
}

/** People linked to it are unlinked; invoices keep their copy of the company's details. */
export async function deleteCompany(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid company.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("companies").delete().eq("id", id);
  if (error) return fail("Couldn't remove the company.");
  await audit(db, viewer.id, "company.delete", "company", id);
  refresh();
  return ok(undefined, "Company removed.");
}

export async function saveCompanyNote(id: string, note: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid company.");
  const value = String(note ?? "").trim().slice(0, 2000) || null;
  const { db, viewer } = await staffDb();
  const { error } = await db.from("companies").update({ note: value }).eq("id", id);
  if (error) return fail("Couldn't save the note.");
  await audit(db, viewer.id, "company.note", "company", id);
  refresh(id);
  return ok(undefined, "Note saved.");
}

const linkSchema = z.object({
  kind: z.enum(["manual", "account"]),
  id: z.uuid(),
  companyId: z.uuid().nullable(),
});

/** Link a customer (added by hand or a website account) to a company, or unlink them with null. */
export async function linkCustomerToCompany(input: z.input<typeof linkSchema>): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid customer.");
  const { kind, id, companyId } = parsed.data;
  const { db, viewer } = await staffDb();
  const table = kind === "manual" ? "manual_customers" : "profiles";
  // Unlinking clears the copied name too; linking fills it from the company (database trigger).
  const row = companyId ? { company_id: companyId } : kind === "manual" ? { company_id: null, company: null } : { company_id: null, company_name: null };
  const { error } = await db.from(table).update(row).eq("id", id);
  if (error) return fail("Couldn't change the company.");
  await audit(db, viewer.id, companyId ? "company.link" : "company.unlink", "company", companyId, { kind, id });
  refresh(companyId ?? undefined);
  revalidatePath(kind === "manual" ? `/admin/customers/manual/${id}` : `/admin/customers/${id}`);
  return ok(undefined, companyId ? "Linked to the company." : "Unlinked from the company.");
}

/** Customers and accounts to link to a company, searched by name, email, phone or CID. */
export async function searchLinkableCustomers(q: string): Promise<CompanyMember[]> {
  const { db } = await staffDb();
  const term = clean(q);
  if (!term) return [];
  const n = parseCid(term);
  const [manual, accounts] = await Promise.all([
    db
      .from("manual_customers")
      .select("id, number, full_name, email, phone")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%${n != null ? `,number.eq.${n}` : ""}`)
      .order("full_name")
      .limit(10),
    db
      .from("profiles")
      .select("id, cid, full_name, email, phone")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%${n != null ? `,cid.eq.${n}` : ""}`)
      .order("full_name")
      .limit(10),
  ]);
  return [
    ...(manual.data ?? []).map((m) => ({ kind: "manual" as const, id: m.id, cid: m.number, name: m.full_name, email: m.email, phone: m.phone })),
    ...(accounts.data ?? []).map((p) => ({ kind: "account" as const, id: p.id, cid: p.cid, name: p.full_name ?? p.email, email: p.email, phone: p.phone })),
  ];
}
