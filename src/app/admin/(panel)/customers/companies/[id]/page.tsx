import Link from "next/link";
import { notFound } from "next/navigation";
import { IconDeliveryNote, IconDocument, IconPhone, IconPlus } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { saveCompanyNote } from "@/lib/actions/admin/companies";
import { COMPANY_COLS, companyAddressLines, type Company, type CompanyMember } from "@/lib/companies";
import { deliveryNoteNo } from "@/lib/delivery-notes";
import { altAddressLines, manualInvoiceNo, telHref } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";
import { Badge, ButtonLink, Card, PageHeader, btn } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { CopyButton } from "@/components/ui/copy-button";
import { NoteEditor } from "@/components/admin/customers/note-editor";
import { CompanyMembers } from "@/components/admin/companies/company-members";
import { EditCompanyButton } from "@/components/admin/companies/edit-company-button";

export const metadata = { title: "Company" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <address className="mt-1 text-sm not-italic leading-relaxed text-ink-soft">
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </address>
    </div>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data: c }, { data: manual }, { data: accounts }, { data: invoices }, { data: notes }] = await Promise.all([
    db.from("companies").select(COMPANY_COLS).eq("id", id).maybeSingle(),
    db.from("manual_customers").select("id, number, full_name, email, phone").eq("company_id", id).order("full_name"),
    db.from("profiles").select("id, cid, full_name, email, phone").eq("company_id", id).order("full_name"),
    db
      .from("invoices")
      .select("id, number, total_pence, issued_on, due_on, paid_at")
      .eq("company_id", id)
      .order("issued_on", { ascending: false })
      .order("number", { ascending: false }),
    db.from("delivery_notes").select("id, number, issued_on").eq("company_id", id).order("issued_on", { ascending: false }).order("number", { ascending: false }),
  ]);
  if (!c) notFound();
  const company = c as Company;
  const members: CompanyMember[] = [
    ...(manual ?? []).map((m) => ({ kind: "manual" as const, id: m.id, cid: m.number, name: m.full_name, email: m.email, phone: m.phone })),
    ...(accounts ?? []).map((p) => ({ kind: "account" as const, id: p.id, cid: p.cid, name: p.full_name ?? p.email, email: p.email, phone: p.phone })),
  ];
  const invoiced = (invoices ?? []).reduce((s, i) => s + i.total_pence, 0);
  const unpaid = (invoices ?? []).filter((i) => !i.paid_at).reduce((s, i) => s + i.total_pence, 0);
  const first = companyAddressLines(company);
  const second = altAddressLines(company);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/customers/companies", label: "Companies" }}
        title={company.name}
        description={[company.vat_number && `VAT ${company.vat_number}`, company.company_number && `Company no. ${company.company_number}`].filter(Boolean).join(" · ") || "Company"}
        actions={
          <>
            <EditCompanyButton company={company} />
            <ButtonLink href={`/admin/invoices/new?company=${company.id}`}>
              <IconPlus className="size-4" /> Invoice
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 border-y border-ink/80">
        {[
          { label: "Invoiced", value: formatPence(invoiced) },
          { label: "Unpaid", value: formatPence(unpaid) },
          { label: "People", value: String(members.length) },
        ].map((s, i) => (
          <div key={s.label} className={"px-3 py-4 md:px-5 " + (i ? "border-l border-ink/15" : "")}>
            <p className="font-display text-2xl tabular-nums text-aubergine-900 md:text-4xl">{s.value}</p>
            <p className="text-sm text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="People" description="Customers linked to this company. Linking here also shows on their page." bodyClassName="p-0">
            <CompanyMembers companyId={company.id} members={members} />
          </Card>

          <Card title="Invoices" bodyClassName="p-0">
            {(invoices ?? []).length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-soft">
                <IconDocument className="size-4" /> No invoices yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {invoices!.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                    <Link href={`/admin/invoices/${i.id}`} className="font-display text-lg tabular-nums text-aubergine-900 hover:underline">
                      {manualInvoiceNo(i.number)}
                    </Link>
                    <span className="flex-1 text-sm text-stone-500">{formatDate(i.issued_on)}</span>
                    {i.paid_at ? <Badge tone="green">Paid</Badge> : i.due_on && i.due_on < today() ? <Badge tone="red">Overdue</Badge> : <Badge tone="gold">Unpaid</Badge>}
                    <span className="w-20 text-right text-sm tabular-nums">{formatPence(i.total_pence)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(notes ?? []).length > 0 && (
            <Card title="Delivery notes" bodyClassName="p-0">
              <ul className="divide-y divide-ink/10">
                {notes!.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-5 py-3">
                    <IconDeliveryNote className="size-4 text-stone-500" />
                    <Link href={`/admin/delivery-notes/${n.id}`} className="font-display text-lg tabular-nums text-aubergine-900 hover:underline">
                      {deliveryNoteNo(n.number)}
                    </Link>
                    <span className="flex-1 text-sm text-stone-500">{formatDate(n.issued_on)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Contact">
            {company.email && (
              <div className="flex items-center justify-between gap-2">
                <a href={`mailto:${company.email}`} className="break-all text-aubergine-700 underline-offset-2 hover:underline">
                  {company.email}
                </a>
                <CopyButton text={company.email} />
              </div>
            )}
            {company.phone ? (
              <a href={telHref(company.phone)} className={btn("secondary", "sm") + " mt-3"}>
                <IconPhone className="size-4" /> Call {company.phone}
              </a>
            ) : (
              <p className="text-sm italic text-stone-500">No number on file</p>
            )}
            {first.length > 0 && <Address title="Address" lines={first} />}
            {second.length > 0 && <Address title="Second address" lines={second} />}
            <NoteEditor note={company.note} max={2000} onSave={saveCompanyNote.bind(null, company.id)} className="mt-4 border-t border-ink/10 pt-4" />
          </Card>
        </div>
      </div>
    </div>
  );
}
