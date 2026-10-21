import { staffDb } from "@/lib/actions/admin/guard";
import { editorData } from "@/lib/data/invoices";
import { PageHeader } from "@/components/admin/ui";
import { DeliveryNoteEditor } from "@/components/admin/delivery-notes/delivery-note-editor";

export const metadata = { title: "New delivery note" };

export default async function NewDeliveryNotePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const { db } = await staffDb();
  const { customer: chosen } = await editorData(db, customer);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/delivery-notes", label: "Delivery notes" }}
        title="New delivery note"
        description="Fill it in like the pad: who it's for, where it's going and what's in it. Prices are optional."
      />
      <DeliveryNoteEditor note={null} customer={chosen} />
    </div>
  );
}
