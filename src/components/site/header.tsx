"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconBasket, IconMenu, IconUser } from "@/components/icons";
import { Logo } from "./brand";
import { MobileMenu } from "./mobile-menu";
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
  const closeMenu = useCallback(() => setMenu(false), []);

  useEffect(() => {
    const on = () => {
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      const end = hero ? hero.offsetTop + hero.offsetHeight - 80 : 40;
      setScrolled(window.scrollY > end);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [pathname]);

  useEffect(() => setMenu(false), [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,color,border-color] duration-500 ease-(--ease-silk)",
          overHero ? "border-b border-transparent bg-transparent text-cream-50" : "border-b border-stone-300 bg-cream-100 text-ink",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 md:h-20 md:px-8">
          <Logo tone={overHero ? "light" : "dark"} />

          <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative text-[0.95rem] transition-opacity hover:opacity-100",
                    active ? "opacity-100" : "opacity-80",
                    "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-(--ease-silk) hover:after:scale-x-100",
                    active && "after:scale-x-100",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/account" aria-label="Your account" className="hidden size-11 place-items-center sm:grid">
              <IconUser className="size-[22px]" />
            </Link>
            <button
              onClick={() => setOpen(true)}
              aria-label={`Open basket, ${count} items`}
              className="flex h-11 items-center gap-1.5 text-[0.95rem]"
            >
              <IconBasket className="size-[22px] sm:hidden" />
              <span className="hidden sm:inline">Basket</span>
              <span className="tabular-nums opacity-70">
                <span className="hidden sm:inline">(</span>{hydrated ? count : 0}<span className="hidden sm:inline">)</span>
              </span>
            </button>
            <button onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} className="-mr-2 grid size-11 place-items-center lg:hidden">
              <IconMenu className="size-6" />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={menu} onClose={closeMenu} items={NAV} />
    </>
  );
}
