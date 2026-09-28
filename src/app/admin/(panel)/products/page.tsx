import Link from "next/link";
import { IconBolt, IconPlus } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { cn } from "@/lib/utils";
import { ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { ProductTable, type ProductRow } from "@/components/admin/products/product-table";

export const metadata = { title: "Products" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "On the shop" },
  { key: "hidden", label: "Hidden" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; category?: string }> }) {
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.filter) ? sp.filter! : "all";
  const { db } = await staffDb();
  const [{ data: products }, { data: categories }] = await Promise.all([
    db
      .from("products")
      .select("id, name, slug, colour, colour_hex, sale_mode, price_pence, stock_qty, low_stock_threshold, track_stock, is_active, is_featured, category_id, product_images(storage_path, sort_order)")
      .order("sort_order")
      .order("name"),
    db.from("categories").select("id, name").order("sort_order"),
  ]);

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const q = (sp.q ?? "").toLowerCase().trim();
  const all: ProductRow[] = (products ?? []).map((p) => {
    const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: p.id,
      name: p.name,
      colour: p.colour,
      colour_hex: p.colour_hex,
      sale_mode: p.sale_mode,
      price_pence: p.price_pence,
      stock_qty: Number(p.stock_qty),
      low_stock_threshold: Number(p.low_stock_threshold),
      track_stock: p.track_stock,
      is_active: p.is_active,
      is_featured: p.is_featured,
      category: p.category_id ? catName.get(p.category_id) ?? null : null,
      category_id: p.category_id,
      image: imgs[0]?.storage_path ?? null,
    };
  });
  const counts = {
    all: all.length,
    active: all.filter((p) => p.is_active).length,
    hidden: all.filter((p) => !p.is_active).length,
    low: all.filter((p) => p.track_stock && p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold).length,
    out: all.filter((p) => p.track_stock && p.stock_qty <= 0).length,
  } as Record<string, number>;

  const rows = all.filter((p) => {
    if (filter === "active" && !p.is_active) return false;
    if (filter === "hidden" && p.is_active) return false;
    if (filter === "low" && !(p.track_stock && p.stock_qty <= p.low_stock_threshold)) return false;
    if (filter === "out" && !(p.track_stock && p.stock_qty <= 0)) return false;
    if (sp.category && p.category_id !== sp.category) return false;
    if (q && !`${p.name} ${p.colour ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const link = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ filter, q: sp.q, category: sp.category, ...params })) if (v && !(k === "filter" && v === "all")) u.set(k, v);
    const s = u.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Change prices and stock right here, or open a product to edit everything."
        actions={
          <ButtonLink href="/admin/products/new">
            <IconPlus className="size-4" /> Add a product
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={link({ filter: f.key })}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm",
                f.key === filter ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {f.label} <span className="tabular-nums text-stone-500">{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap gap-2" action="/admin/products">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-[3px] border border-ink/15 bg-white px-2 text-sm">
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={sp.q} placeholder="Search by name or colour" className="h-10 w-full rounded-[3px] border border-ink/15 bg-white px-3 text-sm lg:w-64" />
          <button className="h-10 rounded-[3px] border border-ink/15 bg-cream-50 px-3 text-sm">Find</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconBolt />}
          title={all.length === 0 ? "No products yet" : "No products match"}
          description={all.length === 0 ? "Add your first fabric and it will appear here." : "Try a different filter or search."}
          action={
            all.length === 0 ? (
              <ButtonLink href="/admin/products/new">Add a product</ButtonLink>
            ) : (
              <ButtonLink href="/admin/products" variant="secondary">
                Show all products
              </ButtonLink>
            )
          }
        />
      ) : (
        <ProductTable rows={rows} />
      )}
    </div>
  );
}
