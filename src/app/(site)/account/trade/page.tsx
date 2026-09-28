import Link from "next/link";
import { IconCheck, IconClock, IconInfo } from "@/components/icons";
import { SectionHead } from "@/components/account/section";
import { TradeForm } from "@/components/account/trade-form";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, getTradeInfo, requireViewer } from "@/lib/data/account";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Trade account" };

const benefits = [
  ["Trade pricing", "Workroom rates on every lining, interlining and paper, shown automatically when you sign in."],
  ["Pay on account", "Invoice terms for approved businesses, so cutting never waits on a card."],
  ["Priority cutting", "Trade orders go to the front of the cutting table."],
] as const;

export default async function TradePage() {
  const viewer = await requireViewer("/account/trade");
  const supabase = await createClient();
  const [trade, { data: profile }] = await Promise.all([
    getTradeInfo(viewer.id),
    supabase.from("profiles").select("company_name").eq("id", viewer.id).maybeSingle(),
  ]);

  return (
    <section>
      <SectionHead title="Trade account">
        For curtain makers, upholsterers and interior designers buying regularly.
      </SectionHead>

      {trade.status === "approved" && (
        <StatusPanel icon={<IconCheck className="size-6 text-success" />} title="Your trade account is active">
          Trade prices are applied across the shop while you&apos;re signed in
          {profile?.company_name ? <> for <span className="text-ink">{profile.company_name}</span></> : null}.
          <div className="mt-5"><ButtonLink href="/shop/linings" size="sm">Shop at trade prices</ButtonLink></div>
        </StatusPanel>
      )}

      {trade.status === "pending" && (
        <StatusPanel icon={<IconClock className="size-6 text-gold-600" />} title="Application under review">
          {trade.application ? <>We received the application for <span className="text-ink">{trade.application.company_name}</span> on {formatDate(trade.application.created_at)}. </> : null}
          We check every account personally and usually reply within one working day. You can keep ordering at retail prices meanwhile.
        </StatusPanel>
      )}

      {trade.status === "rejected" && (
        <StatusPanel icon={<IconInfo className="size-6 text-ink-soft" />} title="We couldn't approve your application">
          This is usually because we couldn&apos;t verify the business. <Link href="/contact" className="text-aubergine-700 underline underline-offset-4">Get in touch</Link> and we&apos;ll gladly take another look, or apply again below with more detail.
        </StatusPanel>
      )}

      {(trade.status === "none" || trade.status === "rejected") && (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
          <ol className="space-y-7">
            {benefits.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="font-display text-lg tabular-nums text-gold-600">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-display text-xl text-aubergine-900">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <TradeForm defaultCompany={profile?.company_name} />
        </div>
      )}
    </section>
  );
}

function StatusPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12 flex gap-5 border-y border-stone-300 bg-cream-50 px-5 py-7 md:px-8" role="status">
      <div className="pt-1">{icon}</div>
      <div className="min-w-0">
        <p className="font-display text-2xl text-aubergine-900">{title}</p>
        <div className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  );
}
