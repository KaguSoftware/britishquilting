"use server";

import { staffDb } from "./guard";

export type SearchHit = { kind: "order" | "product" | "customer"; id: string; title: string; subtitle: string; href: string };

export async function adminSearch(query: string): Promise<SearchHit[]> {
  const { db } = await staffDb();
  const q = query.trim().replace(/[%,()]/g, "");
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  const num = q.replace(/^#/, "");

  const orderQuery = /^\d+$/.test(num)
    ? db.from("orders").select("id, number, email, total_pence, status").eq("number", Number(num)).limit(5)
    : db.from("orders").select("id, number, email, total_pence, status").ilike("email", `%${q}%`).order("created_at", { ascending: false }).limit(6);

  const [orders, products, people] = await Promise.all([
    orderQuery,
    db.from("products").select("id, name, colour, is_active").ilike("name", `%${q}%`).limit(6),
    db.from("profiles").select("id, full_name, email").or(`email.ilike.%${q}%,full_name.ilike.%${q}%`).limit(4),
  ]);

  for (const o of orders.data ?? [])
    hits.push({ kind: "order", id: o.id, title: `Order #${o.number}`, subtitle: `${o.email} · £${(o.total_pence / 100).toFixed(2)}`, href: `/admin/orders/${o.id}` });
  for (const p of products.data ?? [])
    hits.push({ kind: "product", id: p.id, title: p.name, subtitle: [p.colour, p.is_active ? "On the shop" : "Hidden"].filter(Boolean).join(" · "), href: `/admin/products/${p.id}` });
  for (const c of people.data ?? [])
    hits.push({ kind: "customer", id: c.id, title: c.full_name || c.email, subtitle: c.email ?? "", href: `/admin/customers/${c.id}` });
  return hits;
}
