import { IconPlus } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { COMPANY_COLS, type Company } from "@/lib/companies";
import { ButtonLink, PageHeader } from "@/components/admin/ui";
import { CustomerTabs } from "@/components/admin/customers/customer-tabs";
import { CompanyBook, type CompanyRow } from "@/components/admin/companies/company-book";

export const metadata = { title: "Companies" };

type Counted = Company & {
  manual_customers: { count: number }[];
  profiles: { count: number }[];
  invoices: { count: number }[];
};

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; add?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().replace(/[%,()\\*]/g, "");
  const { db } = await staffDb();
  let query = db
    .from("companies")
    .select(`${COMPANY_COLS}, manual_customers(count), profiles!profiles_company_id_fkey(count), invoices(count)`)
    .order("name")
    .limit(500);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%,postcode.ilike.%${q}%`);
  const { data } = await query;
  const companies: CompanyRow[] = ((data ?? []) as unknown as Counted[]).map(({ manual_customers, profiles, invoices, ...c }) => ({
    ...c,
    members: (manual_customers[0]?.count ?? 0) + (profiles[0]?.count ?? 0),
    invoices: invoices[0]?.count ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${companies.length} compan${companies.length === 1 ? "y" : "ies"}. Link people to a company from either side: here, or on the customer's own page.`}
        actions={
          <ButtonLink href="/admin/customers/companies?add=1">
            <IconPlus className="size-4" /> Add company
          </ButtonLink>
        }
      />
      <CustomerTabs active="companies" />
      <form className="mb-5 flex flex-wrap gap-2" action="/admin/customers/companies">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Name, email, phone, town or postcode"
          className="h-12 min-w-0 flex-1 basis-full rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:basis-auto lg:h-10 lg:max-w-sm lg:text-sm"
        />
        <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
      </form>
      <CompanyBook companies={companies} searching={!!q} adding={sp.add === "1"} />
    </div>
  );
}
