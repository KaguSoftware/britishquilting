import { staffDb } from "@/lib/actions/admin/guard";
import { editorData } from "@/lib/data/invoices";
import { PageHeader } from "@/components/admin/ui";
import { InvoiceEditor } from "@/components/admin/invoices/invoice-editor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string; company?: string }> }) {
  const { customer, company } = await searchParams;
  const { db } = await staffDb();
  const data = await editorData(db, company ? null : customer, company);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        title="New invoice"
        description="Write an invoice by hand, for a customer or a company: a phone order, a trade account or anything outside the shop."
      />
      <InvoiceEditor invoice={null} customer={data.customer} company={data.company} vatRate={data.vatRate} />
    </div>
  );
}
