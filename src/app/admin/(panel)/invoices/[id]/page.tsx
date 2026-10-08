import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { editorData } from "@/lib/data/invoices";
import { manualInvoiceNo, type ManualInvoice } from "@/lib/invoices";
import { Badge, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { InvoiceEditor } from "@/components/admin/invoices/invoice-editor";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data }, { customers, vatRate }] = await Promise.all([db.from("invoices").select("*").eq("id", id).maybeSingle(), editorData(db)]);
  if (!data) notFound();
  const invoice = data as ManualInvoice;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {manualInvoiceNo(invoice.number)}
            {invoice.paid_at ? (
              <Badge tone="green" className="text-sm">
                Paid
              </Badge>
            ) : (
              <Badge tone="gold" className="text-sm">
                Unpaid
              </Badge>
            )}
          </span>
        }
        description={`For ${invoice.bill_to.full_name}, dated ${formatDate(invoice.issued_on)}.`}
      />
      <InvoiceEditor invoice={invoice} customers={customers} defaultCustomerId={null} vatRate={vatRate} />
    </div>
  );
}
