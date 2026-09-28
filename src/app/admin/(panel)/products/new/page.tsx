import { staffDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/products/product-editor";
import { toForm } from "@/components/admin/products/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const { db } = await staffDb();
  const { data: categories } = await db.from("categories").select("id, name").order("sort_order");
  return (
    <div>
      <PageHeader back={{ href: "/admin/products", label: "All products" }} title="Add a product" description="Fill in what you know. You can come back and add more at any time." />
      <ProductEditor isNew initial={toForm(null, [], crypto.randomUUID())} categories={categories ?? []} />
    </div>
  );
}
