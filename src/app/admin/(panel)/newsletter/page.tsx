import Link from "next/link";
import { IconMail } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader, btn } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";
import { SubscriberToggle } from "@/components/admin/subscriber-toggle";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === "unsubscribed" ? "unsubscribed" : "subscribed";
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const { db } = await staffDb();
  let query = db.from("newsletter_subscribers").select("id, email, source, created_at, unsubscribed_at").order("created_at", { ascending: false }).limit(1000);
  query = show === "subscribed" ? query.is("unsubscribed_at", null) : query.not("unsubscribed_at", "is", null);
  if (q) query = query.ilike("email", `%${q}%`);
  const [{ data }, { count: total }, { count: month }] = await Promise.all([
    query,
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
  ]);
  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Newsletter"
        description="People who asked to hear from you. Download the list to use in your email tool."
        actions={
          <a href="/admin/newsletter/export" className={btn("primary")} download>
            Download list (CSV)
          </a>
        }
      />
      <div className="mb-6 grid grid-cols-2 border-y border-ink/80">
        <div className="px-3 py-4 md:px-5">
          <p className="font-display text-4xl tabular-nums text-aubergine-900">{total ?? 0}</p>
          <p className="text-sm text-stone-500">Subscribed</p>
        </div>
        <div className="border-l border-ink/15 px-3 py-4 md:px-5">
          <p className="font-display text-4xl tabular-nums text-aubergine-900">{month ?? 0}</p>
          <p className="text-sm text-stone-500">Joined in the last 30 days</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-1">
          {[
            { key: "subscribed", label: "Subscribed" },
            { key: "unsubscribed", label: "Unsubscribed" },
          ].map((t) => (
            <Link key={t.key} href={`/admin/newsletter?show=${t.key}`} className={cn("min-h-11 border-b-2 px-3 py-2.5 text-sm", t.key === show ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/admin/newsletter">
          <input type="hidden" name="show" value={show} />
          <input name="q" defaultValue={sp.q} placeholder="Search emails" className="h-12 flex-1 rounded-[3px] border border-ink/15 bg-white px-3 text-base sm:w-64 lg:h-10 lg:text-sm" />
          <button className="h-12 rounded-[3px] border border-ink/15 bg-cream-50 px-4 text-sm lg:h-10">Find</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<IconMail />} title={q ? "No one matches that" : "No subscribers here yet"} />
      ) : (
        <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-14 items-center gap-3 border-b border-ink/10 px-4 py-2 last:border-0 md:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem]">{r.email}</p>
                <p className="text-xs text-stone-500">
                  {formatDate(r.created_at)}
                  {r.source ? ` · from the ${r.source}` : ""}
                </p>
              </div>
              <SubscriberToggle id={r.id} subscribed={!r.unsubscribed_at} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
