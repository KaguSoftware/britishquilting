import Link from "next/link";
import { Crown } from "./brand";
import { NewsletterForm } from "./newsletter-form";

const COLS = [
  { title: "Shop", links: [["Linings", "/shop/linings"], ["Interlinings", "/shop/interlinings"], ["Paper", "/shop/paper"], ["Order samples", "/samples"]] },
  { title: "Help", links: [["Track an order", "/track"], ["Delivery & collection", "/help/delivery"], ["Returns", "/help/returns"], ["Contact us", "/contact"]] },
  { title: "Company", links: [["Our story", "/about"], ["Trade accounts", "/trade"], ["Journal", "/journal"], ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"]] },
] as const;

export function Footer() {
  return (
    <footer className="relative bg-aubergine-950 text-cream-100">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-20 md:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Crown className="h-6 w-auto text-gold-500" />
            <p className="font-display mt-6 max-w-sm text-4xl leading-tight text-cream-50">Letters from the cutting table.</p>
            <p className="mt-3 max-w-sm text-sm text-cream-100/65">New fabrics, workroom guides and the occasional trade offer. No more than twice a month.</p>
            <NewsletterForm />
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLS.map((c) => (
              <div key={c.title}>
                <p className="eyebrow text-gold-300">{c.title}</p>
                <ul className="mt-5 space-y-3">
                  {c.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-cream-100/75 transition-colors hover:text-cream-50">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="stitch mt-16 opacity-40" />
        <div className="mt-8 flex flex-col gap-4 text-xs text-cream-100/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Intermode Limited, trading as British Quilting · London · Family-owned since 1990</p>
          <p className="flex items-center gap-3">
            <span>Secure checkout</span>
            <span aria-hidden>·</span>
            <span>Visa · Mastercard · Amex · Apple Pay · Google Pay · PayPal</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
