import { staffDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { db } = await staffDb();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    db.from("categories").select("id, name, slug, description, image_url, is_visible, sort_order").order("sort_order"),
    db.from("products").select("category_id"),
  ]);
  const count = new Map<string, number>();
  for (const p of prods ?? []) if (p.category_id) count.set(p.category_id, (count.get(p.category_id) ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Categories" description="The groups your products are sorted into on the shop. Use the arrows to change the order they appear in." />
      <CategoryManager categories={(cats ?? []).map((c) => ({ ...c, products: count.get(c.id) ?? 0 }))} />
    </div>
  );
}
