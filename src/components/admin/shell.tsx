"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  IconBolt, IconChart, IconChevronLeft, IconChevronRight, IconClock, IconClose, IconCrown, IconDocument, IconExternal, IconHome, IconLock, IconLogout,
  IconMail, IconMenu, IconOffer, IconParcel, IconPencil, IconSearch, IconSettings, IconStar, IconSwatch, IconTag, IconUsers, IconVan,
} from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { ConfirmProvider } from "./controls";

export type NavCounts = { toPack: number; reviews: number };

type NavItem = { href: string; label: string; icon: typeof IconHome; count?: keyof NavCounts; owner?: boolean };

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Daily",
    items: [
      { href: "/admin", label: "Today", icon: IconHome },
      { href: "/admin/orders", label: "Orders", icon: IconParcel, count: "toPack" },
      { href: "/admin/invoices", label: "Invoices", icon: IconDocument },
    ],
  },
  {
    group: "Shop",
    items: [
      { href: "/admin/products", label: "Products", icon: IconBolt },
      { href: "/admin/categories", label: "Categories", icon: IconSwatch },
      { href: "/admin/discounts", label: "Discounts", icon: IconTag },
      { href: "/admin/offers", label: "Special offers", icon: IconOffer },
      { href: "/admin/shipping", label: "Shipping", icon: IconVan },
    ],
  },
  {
    group: "People",
    items: [
      { href: "/admin/customers", label: "Customers", icon: IconUsers },
      { href: "/admin/reviews", label: "Reviews", icon: IconStar, count: "reviews" },
    ],
  },
  {
    group: "Stories",
    items: [
      { href: "/admin/journal", label: "Journal", icon: IconPencil },
      { href: "/admin/newsletter", label: "Newsletter", icon: IconMail },
    ],
  },
  {
    group: "Owner",
    items: [
      { href: "/admin/finance", label: "Money", icon: IconChart, owner: true },
      { href: "/admin/staff", label: "Staff", icon: IconLock, owner: true },
      { href: "/admin/settings", label: "Settings", icon: IconSettings, owner: true },
      { href: "/admin/activity", label: "Activity log", icon: IconClock, owner: true },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({
  children,
  isOwner,
  name,
  counts,
}: {
  children: ReactNode;
  isOwner: boolean;
  name: string;
  counts: NavCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("bq-admin-collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("bq-admin-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.owner || isOwner) })).filter((g) => g.items.length);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <ConfirmProvider>
      <div className="min-h-svh bg-cream-100 lg:flex">
        {/* ───────── Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-svh shrink-0 flex-col bg-aubergine-950 text-cream-100 transition-[width] duration-300 ease-(--ease-silk) lg:flex print:hidden",
            collapsed ? "w-[76px]" : "w-[264px]",
          )}
        >
          <div className={cn("flex items-center gap-3 px-5 pb-5 pt-6", collapsed && "justify-center px-0")}>
            <Image src="/brand/logo.png" alt="" width={36} height={36} className="size-9 rounded-full ring-1 ring-gold-500/40" />
            {!collapsed && (
              <div className="leading-tight">
                <p className="font-display text-[1.2rem] text-cream-50">British Quilting</p>
                <p className="font-display text-[0.85rem] italic text-gold-300/80">the workroom</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className={cn(
              "mx-3 mb-4 flex items-center gap-2.5 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-cream-100/70 transition hover:border-gold-500/40 hover:text-cream-50",
              collapsed && "justify-center px-0",
            )}
            title="Search (Ctrl K)"
          >
            <IconSearch className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Find anything</span>
                <kbd className="rounded-[3px] border border-white/15 px-1.5 text-[0.65rem] tracking-wide">Ctrl K</kbd>
              </>
            )}
          </button>

          <nav className="flex-1 overflow-y-auto px-3 pb-4" data-lenis-prevent>
            {groups.map((g) => (
              <div key={g.group} className="mb-4">
                {!collapsed ? <p className="mb-1 px-3 font-display text-[0.9rem] italic text-cream-100/45">{g.group}</p> : <div className="mx-4 mb-2 h-px bg-white/10" />}
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const count = item.count ? counts[item.count] : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-sm px-3 py-2 text-[0.9rem] transition-colors",
                            collapsed && "justify-center px-0",
                            active ? "bg-white/10 text-cream-50" : "text-cream-100/70 hover:bg-white/5 hover:text-cream-50",
                          )}
                        >
                          {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold-500" />}
                          <item.icon className={cn("size-[18px] shrink-0", active ? "text-gold-300" : "")} strokeWidth={1.6} />
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {count > 0 &&
                            (collapsed ? (
                              <span className="absolute right-3 top-1.5 size-2 rounded-full bg-gold-500" />
                            ) : (
                              <span className="rounded-full bg-gold-500 px-2 text-[0.7rem] font-semibold text-aubergine-950">{count}</span>
                            ))}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className={cn("border-t border-white/10 p-3", collapsed && "flex flex-col items-center gap-1")}>
            {!collapsed && <p className="truncate px-3 pb-2 text-xs text-cream-100/50">Signed in as {name}</p>}
            <div className={cn("flex gap-1", collapsed && "flex-col")}>
              <Link href="/" target="_blank" title="View the shop" className="flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs text-cream-100/70 hover:bg-white/5 hover:text-cream-50">
                <IconExternal className="size-4" /> {!collapsed && "View shop"}
              </Link>
              <button onClick={signOut} title="Sign out" className="flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs text-cream-100/70 hover:bg-white/5 hover:text-cream-50">
                <IconLogout className="size-4" /> {!collapsed && "Sign out"}
              </button>
              <button onClick={toggle} title={collapsed ? "Expand menu" : "Collapse menu"} className="grid place-items-center rounded-sm px-2 py-2 text-cream-100/60 hover:bg-white/5 hover:text-cream-50">
                {collapsed ? <IconChevronRight className="size-4" /> : <IconChevronLeft className="size-4" />}
              </button>
            </div>
          </div>
        </aside>

        {/* ───────── Mobile top bar */}
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink/15 bg-cream-50 px-4 py-3 lg:hidden print:hidden">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Image src="/brand/logo.png" alt="" width={32} height={32} className="size-8 rounded-full" />
            <span className="font-display text-lg text-aubergine-900">Back office</span>
          </Link>
          <button onClick={() => setPaletteOpen(true)} className="grid size-12 place-items-center rounded-[3px] border border-ink/15 bg-white text-ink-soft" aria-label="Search">
            <IconSearch className="size-[18px]" />
          </button>
        </div>

        <main className="min-w-0 flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>

        {/* ───────── Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-aubergine-950 pb-[env(safe-area-inset-bottom)] text-cream-100 lg:hidden print:hidden">
          <ul className="grid grid-cols-4">
            {[
              { href: "/admin", label: "Today", icon: IconHome },
              { href: "/admin/orders", label: "Orders", icon: IconParcel, count: counts.toPack },
              { href: "/admin/products", label: "Products", icon: IconBolt },
            ].map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[0.72rem]", active ? "text-gold-300" : "text-cream-100/65")}>
                    <i.icon className="size-5" strokeWidth={1.6} />
                    {i.label}
                    {!!i.count && <span className="absolute right-[22%] top-1.5 rounded-full bg-gold-500 px-1.5 text-[0.6rem] font-semibold text-aubergine-950">{i.count}</span>}
                  </Link>
                </li>
              );
            })}
            <li>
              <button onClick={() => setMoreOpen(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-1 py-2 text-[0.72rem] text-cream-100/65">
                <IconMenu className="size-5" /> More
              </button>
            </li>
          </ul>
        </nav>

        <AnimatePresence>
          {moreOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div className="absolute inset-0 bg-aubergine-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.35, ease: [0.2, 0.7, 0.1, 1] }}
                className="absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-[6px] bg-cream-50 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-display text-2xl text-aubergine-900">Everything</p>
                  <button onClick={() => setMoreOpen(false)} className="rounded-full p-2 text-ink-soft" aria-label="Close">
                    <IconClose className="size-5" />
                  </button>
                </div>
                {groups.map((g) => (
                  <div key={g.group} className="mb-4">
                    <p className="mb-2 font-display text-lg italic text-stone-500">{g.group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {g.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex min-h-12 items-center gap-2.5 rounded-[3px] border px-3 py-3 text-sm",
                            isActive(pathname, item.href) ? "border-aubergine-300 bg-aubergine-100 text-aubergine-800" : "border-stone-300 bg-white text-ink",
                          )}
                        >
                          <item.icon className="size-4 text-aubergine-600" /> {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link href="/" className="flex items-center justify-center gap-2 rounded-sm border border-stone-300 py-3 text-sm text-ink-soft">
                    <IconExternal className="size-4" /> View shop
                  </Link>
                  <button onClick={signOut} className="flex items-center justify-center gap-2 rounded-sm border border-stone-300 py-3 text-sm text-ink-soft">
                    <IconLogout className="size-4" /> Sign out
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} isOwner={isOwner} />
      </div>
    </ConfirmProvider>
  );
}
