import { staffDb } from "@/lib/actions/admin/guard";
import { editorData } from "@/lib/data/invoices";
import { PageHeader } from "@/components/admin/ui";
import { InvoiceEditor } from "@/components/admin/invoices/invoice-editor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const { db } = await staffDb();
  const { customers, vatRate } = await editorData(db);
  const defaultCustomerId = customers.some((c) => c.id === customer) ? customer! : null;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        title="New invoice"
        description="Write an invoice by hand, for a phone order, a trade account or anything outside the shop."
      />
      <InvoiceEditor invoice={null} customers={customers} defaultCustomerId={defaultCustomerId} vatRate={vatRate} />
    </div>
  );
}
