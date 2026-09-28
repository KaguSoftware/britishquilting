"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { IconArrowRight as ArrowRight } from "@/components/icons";
import { Crown } from "@/components/site/brand";
import { FabricPlaceholder } from "@/components/shop/product-card";

gsap.registerPlugin(ScrollTrigger);

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

export type HeroCategory = { slug: string; name: string; blurb: string };

const CHAPTERS = [
  { eyebrow: "Linings", title: "Cotton sateen, cut to the centimetre.", body: "The quiet layer behind every beautiful curtain: soft hand, clean fall, colour-fast." },
  { eyebrow: "Interlinings", title: "Bump & domette for a fuller drape.", body: "Warmth, weight and that heavy, luxurious fold that only proper interlining gives." },
  { eyebrow: "For the trade", title: "Trusted by London workrooms since 1990.", body: "Trade pricing, full rolls and pay-on-invoice for curtain makers and upholsterers." },
];

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Hero({ categories }: { categories: HeroCategory[] }) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [mode, setMode] = useState<"pending" | "webgl" | "static">("pending");
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined &&
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory! < 3;
    setMode(!reduced && !lowPower && supportsWebGL() ? "webgl" : "static");
  }, []);

  useEffect(() => {
    if (mode !== "webgl" || !root.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (st) => { progress.current = st.progress; },
        },
      });
      // Timeline spans 0 → 1 so positions read as scroll progress.
      tl.to("[data-hero-intro]", { opacity: 0, y: -60, filter: "blur(6px)", duration: 0.14 }, 0.06)
        .to("[data-hero-cue]", { opacity: 0, duration: 0.05 }, 0.02);
      const spans = [[0.38, 0.52], [0.52, 0.66], [0.64, 0.76]];
      gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((el, i) => {
        const [a, b] = spans[i];
        tl.fromTo(el, { opacity: 0, y: 40, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.04 }, a)
          .to(el, { opacity: 0, y: -40, duration: 0.03 }, b - 0.03);
      });
      tl.fromTo("[data-chapter-scrim]", { opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.36)
        .to("[data-chapter-scrim]", { opacity: 0, duration: 0.04 }, 0.74);
      tl.fromTo("[data-stitch]", { scaleX: 0 }, { scaleX: 1, duration: 0.3 }, 0.4);
      tl.fromTo("[data-hero-cards] > *",
        { opacity: 0, y: 80, rotateX: -12 },
        { opacity: 1, y: 0, rotateX: 0, stagger: 0.02, duration: 0.08 }, 0.86);
      tl.to("[data-hero-bg]", { "--glow": 0.9, duration: 0.3 }, 0.6);
      tl.set({}, {}, 1);
    }, root);
    return () => ctx.revert();
  }, [mode]);

  if (mode === "static") return <StaticHero categories={categories} />;

  return (
    <section ref={root} data-hero aria-label="British Quilting" className="relative h-[520vh] bg-aubergine-950 text-cream-50">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* backdrop */}
        <div
          data-hero-bg
          aria-hidden
          className="absolute inset-0"
          style={{
            // @ts-expect-error custom property animated by GSAP
            "--glow": 0.45,
            background:
              "radial-gradient(120% 80% at 50% 30%, rgb(116 65 139 / calc(var(--glow) * 1)) 0%, transparent 60%), radial-gradient(90% 60% at 50% 110%, rgb(201 164 92 / 0.18), transparent 70%), linear-gradient(#1c0a24, #2a1036)",
          }}
        />

        {/* poster: painted immediately, cross-fades to the live scene */}
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-(--ease-silk)"
          style={{ opacity: sceneReady ? 0 : 1 }}
        >
          <div className="h-[9vh] w-[62vw] max-w-[640px] rounded-full bg-[linear-gradient(180deg,#f6eedb,#d8c7a6_55%,#a8946f)] shadow-[0_40px_80px_-20px_rgba(0,0,0,.6)]" />
        </div>

        {mode === "webgl" && <HeroScene progress={progress} onReady={() => setTimeout(() => setSceneReady(true), 150)} />}

        {/* intro copy */}
        <div data-hero-intro className="pointer-events-none absolute inset-x-0 top-[12vh] flex flex-col items-center px-4 text-center">
          <Crown className="mb-6 h-7 w-auto text-gold-500" />
          <p className="eyebrow text-gold-300">Family-run in London · Since 1990</p>
          <h1 className="font-display mt-5 max-w-4xl text-[clamp(2.6rem,7vw,6.2rem)] leading-[0.95]">
            The fabric behind <em className="text-gold-300">beautiful</em> curtains.
          </h1>
        </div>

        <div data-hero-cue className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 text-cream-100/70">
          <span className="eyebrow">Scroll to unfurl</span>
          <span className="block h-10 w-px overflow-hidden bg-cream-50/15">
            <span className="block h-1/2 w-px animate-[cue_1.8s_var(--ease-drape)_infinite] bg-gold-500" />
          </span>
        </div>

        {/* chapters: on phones the copy sits over the cloth, so a scrim keeps it legible */}
        <div data-chapter-scrim aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62svh] bg-[linear-gradient(to_top,rgb(28_10_36/.92)_0%,rgb(28_10_36/.78)_45%,transparent_100%)] opacity-0 md:hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-end pb-[max(12vh,calc(env(safe-area-inset-bottom)+4rem))] md:items-center md:pb-0">
          {CHAPTERS.map((c, i) => (
            <div
              key={c.eyebrow}
              data-chapter
              className={`absolute max-w-md px-6 opacity-0 md:px-12 ${i % 2 === 0 ? "left-0" : "right-0 md:text-right"}`}
            >
              <p className="eyebrow text-gold-300">
                {String(i + 1).padStart(2, "0")} · {c.eyebrow}
              </p>
              <h2 className="font-display mt-3 text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">{c.title}</h2>
              <p className="mt-4 max-w-sm text-cream-100/90 md:inline-block md:text-cream-100/75">{c.body}</p>
            </div>
          ))}
        </div>

        <div data-stitch aria-hidden className="stitch absolute inset-x-[8vw] bottom-[5vh] origin-left opacity-50" />

        {/* final beat: the cloth splits into these */}
        <div className="absolute inset-0 flex items-center justify-center px-4 [perspective:1200px]">
          <div data-hero-cards className="grid w-full max-w-6xl gap-4 md:grid-cols-3">
            {categories.slice(0, 3).map((c, i) => (
              <CategoryCard key={c.slug} c={c} i={i} />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes cue{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
    </section>
  );
}

// Same colours the three cloth strips settle into, so the handoff reads as one object
const CARD_CLOTH = ["#f1e7d3", "#d6c29c", "#caa566"];

function CategoryCard({ c, i }: { c: HeroCategory; i: number }) {
  return (
    <Link
      href={`/shop/${c.slug}`}
      className="group relative flex min-h-[26vh] flex-col justify-end overflow-hidden rounded-[2px] p-6 text-ink opacity-0 shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)] transition-transform duration-700 ease-(--ease-silk) hover:-translate-y-1.5 md:min-h-[46vh] md:p-8"
    >
      <FabricPlaceholder hex={CARD_CLOTH[i % 3]} />
      <span aria-hidden className="stitch absolute inset-x-6 top-6 opacity-70 md:inset-x-8 md:top-8" />
      <span className="eyebrow relative text-aubergine-700/80">0{i + 1} · Shop</span>
      <span className="font-display relative mt-2 text-4xl md:text-5xl">{c.name}</span>
      <span className="relative mt-3 max-w-xs text-sm text-ink-soft">{c.blurb}</span>
      <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-medium text-aubergine-700">
        Explore <ArrowRight className="size-4 transition-transform duration-500 ease-(--ease-silk) group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function StaticHero({ categories }: { categories: HeroCategory[] }) {
  return (
    <section aria-label="British Quilting" className="relative overflow-hidden bg-aubergine-950 text-cream-50">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_20%,rgb(116_65_139/.55),transparent_60%),linear-gradient(#1c0a24,#2a1036)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-[18vh] text-center">
        <Crown className="mb-6 h-7 w-auto text-gold-500" />
        <p className="eyebrow text-gold-300">Family-run in London · Since 1990</p>
        <h1 className="font-display mt-5 max-w-4xl text-[clamp(2.6rem,7vw,6.2rem)] leading-[0.95]">
          The fabric behind <em className="text-gold-300">beautiful</em> curtains.
        </h1>
        <div className="mt-16 grid w-full gap-4 text-left md:grid-cols-3 [&>*]:opacity-100">
          {categories.slice(0, 3).map((c, i) => (
            <CategoryCard key={c.slug} c={c} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
