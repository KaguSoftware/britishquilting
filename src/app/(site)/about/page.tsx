import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { PageHeader, btnPrimary, btnSecondary } from "@/components/shop/bits";
import { Reveal } from "@/components/site/reveal";
import SplitText from "@/components/reactbits/SplitText";

export const metadata: Metadata = {
  title: "Our story",
  description: "A London family business supplying curtain linings, interlinings and workroom paper since 1990.",
  alternates: { canonical: "/about" },
};

const LEDGER = [
  ["1990", "The first bolts", "We open in London supplying cotton sateen and bump to local curtain makers from a single cutting table."],
  ["1990s", "The trade grows", "Upholsterers, soft furnishers and theatre workrooms across the capital begin ordering by the roll."],
  ["2000s", "Wider cloth, wider reach", "We add wide-width linings for large windows and start posting cut lengths across the UK."],
  ["Today", "Same table, same care", "Every order is still measured twice and cut by hand, now with fast dispatch and free swatches."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Since 1990"
        title={<SplitText tag="span" text="Three decades at the cutting table." splitType="words" delay={60} duration={0.9} textAlign="left" className="!block" />}
        lede="British Quilting is a family business in London. We supply the layers you never see and always notice: the linings, interlinings and papers that make curtains, blinds and upholstery hang, wear and last properly."
        crumbs={[{ href: "/", label: "Home" }, { label: "Our story" }]}
      />

      <section className="mx-auto grid max-w-7xl gap-14 px-4 py-20 md:grid-cols-[1fr_1.3fr] md:px-8 md:py-32 lg:gap-28">
        <Reveal>
          <blockquote className="font-display text-4xl leading-[1.15] md:text-5xl">
            &ldquo;A curtain is only as good as what&apos;s behind it.&rdquo;
          </blockquote>
          <p className="mt-6 text-sm text-ink-soft">Mustafa, British Quilting</p>
        </Reveal>
        <Reveal delay={0.1} className="space-y-6 text-lg leading-relaxed text-ink-soft">
          <p>
            We started in 1990 with a simple idea: London&apos;s workrooms deserved a supplier who understood cloth the way they did.
            Someone who knew why a domette suits a Roman blind, why wide sateen saves a seam, and why a length should be rolled, not folded.
          </p>
          <p>
            More than thirty years on, the family still runs the business day to day. We still cut every order by hand, check it against the light for flaws,
            and wrap it the same week. Many of our customers have ordered from us for decades, and some of their apprentices now run workrooms of their own.
          </p>
          <p>
            Whether you&apos;re lining a single pair of kitchen curtains or fitting out a hotel, you&apos;ll get the same measured care and the same honest advice.
          </p>
        </Reveal>
      </section>

      <section className="border-y border-stone-300 bg-cream-50">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <Reveal>
            <h2 className="font-display text-4xl md:text-5xl">The ledger</h2>
          </Reveal>
          <ol className="mt-12 border-t border-ink/80">
            {LEDGER.map(([y, t, d], i) => (
              <Reveal as="li" key={y} delay={i * 0.06} className="grid gap-2 border-b border-stone-300 py-8 md:grid-cols-[160px_280px_1fr] md:gap-10">
                <span className="font-display text-3xl text-gold-600 tabular-nums">{y}</span>
                <span className="font-display text-2xl">{t}</span>
                <span className="text-ink-soft">{d}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-32">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            ["Measured twice", "Every length is measured on a fixed rule and cut square across the weave, with a little allowance where the cloth needs it."],
            ["Rolled, not folded", "Long lengths leave us on a tube wherever possible, so they arrive free of creases and ready to cut."],
            ["Honest advice", "Not sure whether you need bump or domette? Call us. We'd rather you bought the right cloth than the most expensive one."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.08} className="border-t border-stone-300 pt-6">
              <span className="font-display text-5xl text-gold-500 tabular-nums">0{i + 1}</span>
              <h3 className="font-display mt-4 text-3xl">{t}</h3>
              <p className="mt-3 text-ink-soft">{d}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-20 flex flex-wrap gap-3">
          <Link href="/shop" className={btnPrimary}>Browse the cloth room <IconArrowRight className="size-4" /></Link>
          <Link href="/contact" className={btnSecondary}>Talk to us</Link>
        </Reveal>
      </section>
    </>
  );
}
