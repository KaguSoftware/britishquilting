import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { Badge, PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/products/product-editor";
import { toForm } from "@/components/admin/products/product-form";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, viewer } = await staffDb();
  const isOwner = viewer.role === "owner";
  const [{ data: product }, { data: images }, { data: categories }, { count: waiting }] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db.from("product_images").select("id, storage_path, alt, width, height").eq("product_id", id).order("sort_order"),
    db.from("categories").select("id, name").order("sort_order"),
    db.from("stock_alerts").select("id", { count: "exact", head: true }).eq("product_id", id).is("notified_at", null),
  ]);
  if (!product) notFound();
  return (
    <div>
      <PageHeader
        back={{ href: "/admin/products", label: "All products" }}
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {product.is_active ? <Badge tone="green">On the shop</Badge> : <Badge>Hidden</Badge>}
            {!!waiting && <span>{waiting} {waiting === 1 ? "person is" : "people are"} waiting to hear when it&apos;s back in stock.</span>}
          </span>
        }
      />
      <ProductEditor
        key={product.updated_at}
        isNew={false}
        initial={toForm(isOwner ? product : { ...product, cost_price_pence: null }, (images ?? []).map((i) => ({ id: i.id, storage_path: i.storage_path, alt: i.alt ?? "", width: i.width, height: i.height })), product.id)}
        categories={categories ?? []}
        showCost={isOwner}
      />
    </div>
  );
}
