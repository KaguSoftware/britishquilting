"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLogout } from "@/components/icons";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const items = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/trade", label: "Trade account" },
  { href: "/account/settings", label: "Settings" },
];

export function AccountNav() {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

  return (
    <nav aria-label="Account" className="-mx-4 md:mx-0">
      <ol className="flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:flex-col md:gap-0 md:overflow-visible md:border-t md:border-stone-300 md:px-0 md:pb-0">
        {items.map((it, i) => {
          const on = active(it.href, it.exact);
          return (
            <li key={it.href} className="shrink-0 md:border-b md:border-stone-300">
              <Link
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "group flex items-baseline gap-3 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors duration-300 md:border-b-0 md:border-l-2 md:px-4 md:py-3.5",
                  on
                    ? "border-aubergine-700 text-aubergine-900"
                    : "border-transparent text-ink-soft hover:text-aubergine-800 md:hover:border-stone-300",
                )}
              >
                <span className={cn("font-display hidden w-5 text-sm tabular-nums md:inline", on ? "text-gold-600" : "text-stone-500")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={cn(on && "font-medium")}>{it.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 md:mt-6 md:border-0">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm text-ink-soft transition-colors hover:text-danger md:px-4"
            >
              <IconLogout className="size-4" /> Sign out
            </button>
          </form>
        </li>
      </ol>
    </nav>
  );
}
