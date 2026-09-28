import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence } from "@/lib/utils";
import { Badge, Card } from "@/components/admin/ui";
import { ORDER_STATUS, timeAgo, type OrderStatus } from "@/components/admin/format";

export const metadata = { title: "Today" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function londonDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db, viewer } = await staffDb();
  const since = new Date(Date.now() - 30 * 86400_000);

  const [toPack, ready, invoices, products, trade, reviews, paid, recent] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "ready_for_collection"),
    db.from("orders").select("id, total_pence").eq("payment_provider", "invoice").is("paid_at", null).not("status", "in", "(cancelled,refunded,pending)"),
    db.from("products").select("id, stock_qty, low_stock_threshold, track_stock, is_active").eq("track_stock", true),
    db.from("trade_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("orders").select("total_pence, paid_at, status").gte("paid_at", since.toISOString()).not("status", "in", "(cancelled,refunded)"),
    db.from("orders").select("id, number, email, total_pence, status, created_at, shipping_address, fulfilment").not("status", "eq", "pending").order("created_at", { ascending: false }).limit(6),
  ]);

  const lowStock = (products.data ?? []).filter((p) => p.is_active && Number(p.stock_qty) <= Number(p.low_stock_threshold)).length;
  const invoiceTotal = (invoices.data ?? []).reduce((s, o) => s + o.total_pence, 0);

  // Revenue per London day for the last 30 days
  const days: { key: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) days.push({ key: londonDay(new Date(Date.now() - i * 86400_000)), total: 0 });
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const o of paid.data ?? []) {
    const d = byDay.get(londonDay(new Date(o.paid_at)));
    if (d) d.total += o.total_pence;
  }
  const today = days[days.length - 1].total;
  const month = days.reduce((s, d) => s + d.total, 0);
  const todayCount = (paid.data ?? []).filter((o) => londonDay(new Date(o.paid_at)) === days[days.length - 1].key).length;

  const cards = [
    { label: "Orders to pack", value: toPack.count ?? 0, href: "/admin/orders?tab=to_pack&view=board", hint: "Paid and waiting to be cut and packed", urgent: true },
    { label: "Ready for collection", value: ready.count ?? 0, href: "/admin/orders?tab=ready_for_collection", hint: "On the shelf, waiting for the customer" },
    { label: "Awaiting invoice payment", value: invoices.data?.length ?? 0, href: "/admin/orders?tab=invoice_unpaid", hint: invoiceTotal ? `${formatPence(invoiceTotal)} outstanding` : "Nothing outstanding" },
    { label: "Low stock", value: lowStock, href: "/admin/products?filter=low", hint: "At or below the alert level" },
    { label: "Trade applications", value: trade.count ?? 0, href: "/admin/trade", hint: "Waiting for a decision" },
    { label: "Reviews to approve", value: reviews.count ?? 0, href: "/admin/reviews", hint: "Check before they go live" },
  ];

  const first = viewer.fullName?.split(" ")[0];

  return (
    <div>
      {sp["owner-only"] && (
        <div className="mb-6 rounded-sm border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">That page is only available to the owner.</div>
      )}
      <header className="mb-8">
        <p className="mb-1 font-display text-lg italic text-gold-600">
          {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date())}
        </p>
        <h1 className="font-display text-[2.4rem] leading-none text-aubergine-900 md:text-[3rem]">
          {greeting()}
          {first ? `, ${first}` : ""}.
        </h1>
        <p className="mt-2 text-ink-soft">
          {(toPack.count ?? 0) === 0 ? "Nothing waiting to be packed. Lovely." : `${toPack.count} order${toPack.count === 1 ? "" : "s"} to pack today.`}
        </p>
      </header>

      <div className="grid border-t border-ink/80 sm:grid-cols-2">
        {cards.map((c, i) => {
          const hot = c.urgent && c.value > 0;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={
                "group flex items-center gap-4 border-b border-ink/15 py-4 pr-2 transition-colors hover:bg-cream-50 sm:px-4 " +
                (i % 2 === 0 ? "sm:border-r" : "")
              }
            >
              <span
                className={
                  "w-16 shrink-0 text-right font-display text-[2.6rem] leading-none tabular-nums md:w-20 md:text-[3.1rem] " +
                  (hot ? "text-aubergine-800" : c.value > 0 ? "text-ink" : "text-stone-300")
                }
              >
                {c.value}
              </span>
              <span className="min-w-0 flex-1 border-l border-ink/10 pl-4">
                <span className={"block text-[1rem] font-medium " + (hot ? "text-aubergine-800" : "text-ink")}>
                  {c.label}
                  {hot && <span className="ml-2 inline-block size-2 translate-y-[-2px] rounded-full bg-gold-500" />}
                </span>
                <span className="block text-sm text-stone-500">{c.hint}</span>
              </span>
              <IconArrowRight className="size-4 shrink-0 text-stone-300 transition group-hover:translate-x-1 group-hover:text-aubergine-700" />
            </Link>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Takings" description="Paid orders over the last 30 days">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
            <div>
              <p className="text-sm text-stone-500">Today</p>
              <p className="font-display text-4xl text-aubergine-900 tabular-nums">{formatPence(today)}</p>
              <p className="text-xs text-stone-500">{todayCount} order{todayCount === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500">Last 30 days</p>
              <p className="font-display text-4xl text-ink-soft tabular-nums">{formatPence(month)}</p>
            </div>
          </div>
          <Sparkline values={days.map((d) => d.total)} labels={days.map((d) => d.key)} />
        </Card>

        <Card title="Latest orders" action={<Link href="/admin/orders?tab=all" className="text-sm text-aubergine-700 hover:underline">See all</Link>} bodyClassName="p-0">
          <ul className="divide-y divide-stone-300/60">
            {(recent.data ?? []).map((o) => {
              const s = ORDER_STATUS[o.status as OrderStatus];
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        #{o.number} <span className="font-normal text-ink-soft">· {o.shipping_address?.full_name ?? o.email}</span>
                      </p>
                      <p className="text-xs text-stone-500">{timeAgo(o.created_at)}</p>
                    </div>
                    <Badge tone={s?.tone}>{s?.label ?? o.status}</Badge>
                    <span className="w-20 text-right text-sm tabular-nums">{formatPence(o.total_pence)}</span>
                  </Link>
                </li>
              );
            })}
            {(recent.data ?? []).length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-soft">No orders yet. They will appear here the moment they arrive.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Sparkline({ values, labels }: { values: number[]; labels: string[] }) {
  const w = 600;
  const h = 120;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 8 - (v / max) * (h - 20)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  const fmt = (k: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(k));
  return (
    <div className="mt-6">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Takings per day for the last 30 days">
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-gold-500)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--color-gold-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark)" />
        <path d={line} fill="none" stroke="var(--color-aubergine-700)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {values.map((v, i) => (
          <rect key={i} x={i * step - step / 2} y={0} width={step} height={h} fill="transparent">
            <title>{`${fmt(labels[i])}: £${(v / 100).toFixed(2)}`}</title>
          </rect>
        ))}
        <circle cx={last[0]} cy={last[1]} r="4" fill="var(--color-gold-500)" stroke="var(--color-cream-50)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.7rem] text-stone-500">
        <span>{fmt(labels[0])}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
