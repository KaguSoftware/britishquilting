import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { PageHeader, buttonGold, btnSecondaryDark } from "@/components/shop/bits";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Trade accounts",
  description: "Trade prices, full rolls and 30-day invoice terms for curtain makers, upholsterers and interior designers.",
  alternates: { canonical: "/trade" },
};

const BENEFITS = [
  ["Trade prices", "Net pricing across linings and interlinings, shown throughout the site whenever you're signed in."],
  ["Full rolls", "Bump, domette and sateen by the roll for workroom stock, at roll prices."],
  ["30-day invoice terms", "Pay by invoice on approved accounts, with a single monthly statement."],
  ["Priority cutting", "Trade orders go to the front of the cutting queue when time matters."],
  ["Sample books", "Full sample sets for your showroom or client meetings."],
];

export default function TradePage() {
  return (
    <>
      <PageHeader
        tone="dark"
        eyebrow="For the trade"
        title={<>Workroom pricing, <em>on account.</em></>}
        lede="For curtain makers, upholsterers, interior designers and theatre workrooms. Apply once, and trade prices appear automatically whenever you're signed in."
        crumbs={[{ href: "/", label: "Home" }, { label: "Trade" }]}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/account/trade" className={buttonGold}>Apply for a trade account <IconArrowRight className="size-4" /></Link>
          <Link href="/contact" className={btnSecondaryDark}>Ask a question</Link>
        </div>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl">What an account gives you</h2>
        </Reveal>
        <dl className="mt-10 border-t border-ink/80">
          {BENEFITS.map(([k, v], i) => (
            <Reveal key={k} delay={i * 0.04} className="grid gap-2 border-b border-stone-300 py-6 md:grid-cols-[80px_280px_1fr] md:gap-8">
              <span aria-hidden className="font-display text-2xl text-gold-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <dt className="font-display text-2xl">{k}</dt>
              <dd className="text-ink-soft">{v}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className="border-t border-stone-300 bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <Reveal>
            <h2 className="font-display text-4xl md:text-5xl">How to apply</h2>
            <p className="mt-4 max-w-md text-ink-soft">It takes about two minutes. We review every application by hand, usually within one working day.</p>
          </Reveal>
          <div>
            <ol className="space-y-8">
              {[
                ["Create an account", "Or sign in if you already shop with us."],
                ["Tell us about your business", "Company name, what you make, and a website or VAT number if you have one."],
                ["Order at trade", "Once approved, trade prices appear as soon as you sign in."],
              ].map(([t, d], i) => (
                <Reveal as="li" key={t} delay={i * 0.08} className="grid grid-cols-[48px_1fr] gap-4">
                  <span className="font-display text-4xl text-gold-500">{i + 1}</span>
                  <div>
                    <p className="font-display text-2xl">{t}</p>
                    <p className="mt-1 text-ink-soft">{d}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <Link href="/account/trade" className="mt-10 inline-flex items-center gap-2 text-aubergine-700 underline underline-offset-4">
              Start your application <IconArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
