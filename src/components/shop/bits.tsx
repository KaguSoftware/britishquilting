import Link from "next/link";
import {IconChevronRight, IconPlus, IconStar} from "@/components/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/site/reveal";
import { buttonClasses } from "@/components/ui/button";

/* Shared, server-safe building blocks for shop and content pages. */

export const inputCls =
  "block w-full rounded-none border border-stone-300 bg-cream-50 px-4 py-3 text-base text-ink placeholder:text-stone-500 transition-colors focus:border-aubergine-700 focus:outline-none focus-visible:outline-2 aria-[invalid=true]:border-danger md:text-sm";

export const btnPrimary = buttonClasses({ variant: "primary", size: "lg" });

export const btnSecondary = buttonClasses({ variant: "outline", size: "lg" });

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-medium">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1.5">
            {i > 0 && <IconChevronRight aria-hidden className="size-3 text-stone-500" />}
            {it.href ? (
              <Link href={it.href} className="hover:text-aubergine-700 hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Editorial page header used across content pages. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
  children,
  tone = "light",
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  crumbs?: { href?: string; label: string }[];
  children?: ReactNode;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <header
      className={cn(
        "relative overflow-hidden border-b pt-16 md:pt-20",
        dark ? "border-aubergine-800 bg-aubergine-900 text-cream-50" : "border-stone-300 bg-cream-50",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          dark
            ? "bg-[radial-gradient(60%_80%_at_85%_0%,rgb(201_164_92/.22),transparent_60%)]"
            : "bg-[radial-gradient(50%_90%_at_90%_0%,rgb(201_164_92/.14),transparent_65%)]",
        )}
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 md:px-8 md:pb-20 md:pt-14">
        {crumbs && <div className={dark ? "[&_*]:!text-cream-100/70" : ""}><Breadcrumbs items={crumbs} /></div>}
        <Reveal className={crumbs ? "mt-10" : ""}>
          <p className={cn("eyebrow", dark ? "text-gold-300" : "text-gold-600")}>{eyebrow}</p>
          <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[1.02] text-balance md:text-7xl">{title}</h1>
          {lede && <div className={cn("mt-6 max-w-2xl text-lg leading-relaxed", dark ? "text-cream-100/75" : "text-ink-soft")}>{lede}</div>}
        </Reveal>
        {children}
      </div>
    </header>
  );
}

/** Accessible native disclosure, styled. */
export function Accordion({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-stone-300" open={defaultOpen}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="font-display text-2xl">{title}</span>
        <IconPlus aria-hidden className="size-4 shrink-0 text-gold-600 transition-transform duration-500 ease-(--ease-silk) group-open:rotate-45" />
      </summary>
      <div className="pb-6 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}

export function Stars({ value, size = "sm", label }: { value: number; size?: "sm" | "md"; label?: string }) {
  const s = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className={cn("relative inline-block", s)}>
            <IconStar className={cn("absolute inset-0 text-stone-300", s)} strokeWidth={1.5} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <IconStar className={cn("fill-gold-500 text-gold-500", s)} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Long-form typographic container for content pages. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-2xl text-[1.05rem] leading-[1.8] text-ink-soft",
        "[&_h2]:font-display [&_h2]:mb-4 [&_h2]:mt-14 [&_h2]:text-4xl [&_h2]:leading-tight [&_h2]:text-ink",
        "[&_h3]:font-display [&_h3]:mb-3 [&_h3]:mt-10 [&_h3]:text-2xl [&_h3]:text-ink",
        "[&_p]:mb-5 [&_ul]:mb-6 [&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0",
        "[&_li]:relative [&_li]:pl-6 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.8em] [&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:bg-gold-500",
        "[&_a]:text-aubergine-700 [&_a]:underline [&_a]:decoration-gold-500/60 [&_a]:underline-offset-4 hover:[&_a]:decoration-aubergine-700",
        "[&_strong]:font-medium [&_strong]:text-ink [&_blockquote]:font-display [&_blockquote]:my-10 [&_blockquote]:border-l-2 [&_blockquote]:border-gold-500 [&_blockquote]:pl-6 [&_blockquote]:text-3xl [&_blockquote]:leading-snug [&_blockquote]:text-ink",
        "[&_img]:my-8 [&_img]:w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Content page shell: header + two-column body with a sticky aside. */
export function ContentLayout({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_320px] lg:gap-24">
      <div>{children}</div>
      {aside && <aside className="lg:sticky lg:top-28 lg:self-start">{aside}</aside>}
    </div>
  );
}

export function HelpAside() {
  return (
    <div className="border border-stone-300 bg-cream-50 p-7">
      <p className="font-display text-3xl leading-tight">Talk to the workroom.</p>
      <p className="mt-3 text-sm text-ink-soft">Mon to Fri, 9am to 5pm. We usually reply the same day.</p>
      <ul className="mt-6 space-y-3 text-sm">
        <li><a href="tel:+447710131416" className="text-aubergine-700 hover:underline">07710 131416</a></li>
        <li><a href="mailto:mustafa@britishquilting.com" className="break-all text-aubergine-700 hover:underline">mustafa@britishquilting.com</a></li>
        <li><Link href="/contact" className="text-aubergine-700 hover:underline">Send us a message</Link></li>
      </ul>
      <div className="stitch mt-7" />
      <ul className="mt-6 space-y-2 text-sm">
        {[["/help/delivery", "Delivery & collection"], ["/help/returns", "Returns"], ["/faq", "FAQ"], ["/track", "Track an order"]].map(([h, l]) => (
          <li key={h}><Link href={h} className="text-ink-soft hover:text-aubergine-700">{l}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-stone-300 bg-cream-50/60 px-6 py-20 text-center">
      <svg aria-hidden viewBox="0 0 64 64" className="size-14 text-gold-500" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="10" y="14" width="44" height="36" rx="1" />
        <path d="M10 22h44M10 30h44M10 38h44M10 46h44" strokeDasharray="2 3" opacity=".6" />
        <circle cx="48" cy="12" r="4" />
      </svg>
      <h2 className="font-display mt-6 text-3xl md:text-4xl">{title}</h2>
      {children && <div className="mt-3 max-w-md text-ink-soft">{children}</div>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse bg-cream-200", className)} />;
}

export const buttonGold = buttonClasses({ variant: "gold", size: "lg" });
export const btnSecondaryDark =
  "inline-flex h-13 items-center justify-center gap-2 rounded-sm border border-cream-50/30 px-7 text-[0.95rem] font-medium tracking-wide text-cream-50 transition-colors duration-300 hover:border-gold-300 hover:text-gold-300";
