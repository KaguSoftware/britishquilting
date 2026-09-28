import Link from "next/link";
import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/controls";
import { ORDER_STATUS, addressLines, formatDate, type OrderStatus } from "@/components/admin/format";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data: p }, { data: orders }, { data: addresses }, { data: apps }, { data: reviews }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("orders").select("id, number, status, total_pence, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("addresses").select("*").eq("user_id", id).order("is_default", { ascending: false }),
    db.from("trade_applications").select("id, status, company_name, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("reviews").select("id, rating, title, status, created_at").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  if (!p) notFound();
  const counted = (orders ?? []).filter((o) => !["pending", "cancelled", "refunded"].includes(o.status));
  const spent = counted.reduce((s, o) => s + o.total_pence, 0);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/customers", label: "All customers" }}
        title={p.full_name || p.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {p.company_name && <span>{p.company_name}</span>}
            {p.trade_status === "approved" && <Badge tone="gold">Trade customer</Badge>}
            {p.trade_status === "pending" && <Badge tone="neutral">Trade application waiting</Badge>}
            {(p.role === "staff" || p.role === "owner") && <Badge tone="aubergine">{p.role === "owner" ? "Owner" : "Staff"}</Badge>}
            <span>Customer since {formatDate(p.created_at)}</span>
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-3 border-y border-ink/80">
        {[
          { label: "Orders", value: String(counted.length) },
          { label: "Spent", value: formatPence(spent) },
          { label: "Average order", value: counted.length ? formatPence(Math.round(spent / counted.length)) : "None" },
        ].map((s, i) => (
          <div key={s.label} className={"px-3 py-4 md:px-5 " + (i ? "border-l border-ink/15" : "")}>
            <p className="font-display text-2xl tabular-nums text-aubergine-900 md:text-4xl">{s.value}</p>
            <p className="text-sm text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Orders" bodyClassName="p-0">
          {(orders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {orders!.map((o) => {
                const s = ORDER_STATUS[o.status as OrderStatus];
                return (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-cream-100">
                      <span className="font-display text-lg text-aubergine-900">#{o.number}</span>
                      <span className="flex-1 text-sm text-stone-500">{formatDate(o.created_at)}</span>
                      <Badge tone={s?.tone}>{s?.label}</Badge>
                      <span className="w-20 text-right text-sm tabular-nums">{formatPence(o.total_pence)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Contact">
            <div className="flex items-center justify-between gap-2">
              <a href={`mailto:${p.email}`} className="break-all text-aubergine-700 underline-offset-2 hover:underline">
                {p.email}
              </a>
              {p.email && <CopyButton text={p.email} />}
            </div>
            {p.phone && (
              <a href={`tel:${p.phone}`} className="mt-1 block text-aubergine-700">
                {p.phone}
              </a>
            )}
            {p.vat_number && <p className="mt-2 text-sm text-ink-soft">VAT: {p.vat_number}</p>}
            <p className="mt-2 text-sm text-ink-soft">{p.marketing_opt_in ? "Happy to receive emails" : "Doesn't want marketing emails"}</p>
          </Card>

          {(addresses ?? []).length > 0 && (
            <Card title="Saved addresses">
              <ul className="space-y-4">
                {addresses!.map((a) => (
                  <li key={a.id} className="text-sm leading-relaxed">
                    {a.label && <p className="font-medium">{a.label}</p>}
                    {addressLines(a).map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(apps ?? []).length > 0 && (
            <Card title="Trade applications">
              <ul className="space-y-2 text-sm">
                {apps!.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>
                      {a.company_name} <span className="text-stone-500">· {formatDate(a.created_at)}</span>
                    </span>
                    <Link href={`/admin/trade?show=${a.status}`}>
                      <Badge tone={a.status === "approved" ? "green" : a.status === "rejected" ? "red" : "gold"}>{a.status === "pending" ? "Waiting" : a.status === "approved" ? "Approved" : "Declined"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(reviews ?? []).length > 0 && (
            <Card title="Reviews">
              <ul className="space-y-2 text-sm">
                {reviews!.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      {"★".repeat(r.rating)} {r.title}
                    </span>
                    <span className="text-stone-500">{r.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
