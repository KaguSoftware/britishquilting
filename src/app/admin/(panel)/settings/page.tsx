import { ownerDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { db } = await ownerDb();
  const { data } = await db.from("store_settings").select("*").eq("id", 1).single();
  return (
    <div>
      <PageHeader title="Settings" description="How the shop runs. Only you, as the owner, can change these." />
      <SettingsForm
        initial={{
          collection_enabled: data?.collection_enabled ?? true,
          collection_address: data?.collection_address ?? "",
          collection_hours: data?.collection_hours ?? "",
          invoice_terms_days: String(data?.invoice_terms_days ?? 30),
          bank_details: data?.bank_details ?? "",
          low_stock_email: data?.low_stock_email ?? "",
          announcement: data?.announcement ?? "",
        }}
      />
    </div>
  );
}
