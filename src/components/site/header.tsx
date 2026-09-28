"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "./brand";
import { useCart } from "@/components/cart/cart-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/shop/linings", label: "Linings" },
  { href: "/shop/interlinings", label: "Interlinings" },
  { href: "/shop/paper", label: "Paper" },
  { href: "/samples", label: "Samples" },
  { href: "/journal", label: "Journal" },
  { href: "/trade", label: "Trade" },
];

export function Header() {
  const pathname = usePathname();
  const { count, setOpen, hydrated } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const on = () => {
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      const end = hero ? hero.offsetTop + hero.offsetHeight - 80 : window.innerHeight * 0.6;
      setScrolled(window.scrollY > end);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [pathname]);

  useEffect(() => setMenu(false), [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,color,box-shadow,backdrop-filter] duration-500 ease-(--ease-silk)",
        overHero
          ? "bg-transparent text-cream-50"
          : "bg-cream-100/85 text-ink shadow-[0_1px_0_var(--color-stone-300)] backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 md:h-20 md:px-8">
        <Logo tone={overHero ? "light" : "dark"} />

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "relative text-[0.92rem] tracking-wide transition-opacity hover:opacity-100",
                pathname.startsWith(n.href) ? "opacity-100" : "opacity-75",
                "after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-gold-500 after:transition-transform after:duration-500 hover:after:scale-x-100",
                pathname.startsWith(n.href) && "after:scale-x-100",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link href="/account" aria-label="Your account" className="grid size-11 place-items-center rounded-full transition-colors hover:bg-current/10">
            <User className="size-5" strokeWidth={1.5} />
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label={`Open basket, ${count} items`}
            className="relative grid size-11 place-items-center rounded-full transition-colors hover:bg-current/10"
          >
            <ShoppingBag className="size-5" strokeWidth={1.5} />
            {hydrated && count > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-gold-500 px-1 text-[0.65rem] font-semibold leading-4.5 text-aubergine-950">
                {count}
              </span>
            )}
          </button>
          <button onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu} className="grid size-11 place-items-center rounded-full lg:hidden">
            {menu ? <X className="size-5" /> : <Menu className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      <div
        className={cn(
          "grid overflow-hidden bg-aubergine-950 text-cream-50 transition-[grid-template-rows] duration-500 ease-(--ease-silk) lg:hidden",
          menu ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <nav aria-label="Mobile" className="min-h-0">
          <ul className="px-4 py-6">
            {NAV.map((n) => (
              <li key={n.href} className="border-b border-cream-50/10 last:border-0">
                <Link href={n.href} className="font-display block py-4 text-3xl">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
