import { staffDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { ShippingEditor } from "@/components/admin/shipping-editor";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  const { db } = await staffDb();
  const [{ data: rates }, { data: settings }] = await Promise.all([
    db.from("shipping_rates").select("*").order("sort_order"),
    db.from("store_settings").select("free_shipping_threshold_pence").eq("id", 1).single(),
  ]);
  return (
    <div>
      <PageHeader title="Shipping" description="The delivery options customers choose from at checkout. We pick the options that fit the weight of their basket." />
      <ShippingEditor rates={rates ?? []} freeThreshold={settings?.free_shipping_threshold_pence ?? null} />
    </div>
  );
}
