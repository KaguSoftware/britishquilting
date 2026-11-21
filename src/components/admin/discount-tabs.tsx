"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/discounts/offers", label: "Special offers" },
  { href: "/admin/discounts/codes", label: "Discount codes" },
  { href: "/admin/discounts/birthdays", label: "Birthday treats" },
];

/** The three kinds of discount, each its own page under Discounts. */
export function DiscountTabs() {
  const path = usePathname();
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-ink/10 px-4 lg:mx-0 lg:px-0" aria-label="Kinds of discount">
      {TABS.map((t, i) => {
        const active = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-baseline gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            <span className="font-display tabular-nums text-gold-600">{["i.", "ii.", "iii."][i]}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
