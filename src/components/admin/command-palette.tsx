"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconArrowRight, IconBolt, IconParcel, IconPlus, IconSearch, IconUser } from "@/components/icons";
import { adminSearch, type SearchHit } from "@/lib/actions/admin/search";
import { cn } from "@/lib/utils";
import { NAV } from "./shell";

type Row = { key: string; title: string; subtitle?: string; href: string; icon: typeof IconSearch; group: string };

const QUICK: Row[] = [
  { key: "new-product", title: "Add a new product", href: "/admin/products/new", icon: IconPlus, group: "Quick actions" },
  { key: "to-pack", title: "Orders to pack", href: "/admin/orders?tab=to_pack&view=board", icon: IconParcel, group: "Quick actions" },
  { key: "new-discount", title: "Create a discount code", href: "/admin/discounts?new=1", icon: IconPlus, group: "Quick actions" },
  { key: "new-post", title: "Write a journal post", href: "/admin/journal/new", icon: IconPlus, group: "Quick actions" },
];

export function CommandPalette({ open, onClose, isOwner }: { open: boolean; onClose: () => void; isOwner: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setHits(await adminSearch(term));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const rows = useMemo<Row[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Row[] = NAV.flatMap((g) => g.items)
      .filter((i) => !i.owner || isOwner)
      .map((i) => ({ key: i.href, title: i.label, href: i.href, icon: i.icon, group: "Go to" }));
    const match = (r: Row) => !term || r.title.toLowerCase().includes(term);
    const found: Row[] = hits.map((h) => ({
      key: `${h.kind}-${h.id}`,
      title: h.title,
      subtitle: h.subtitle,
      href: h.href,
      icon: h.kind === "order" ? IconParcel : h.kind === "product" ? IconBolt : IconUser,
      group: h.kind === "order" ? "Orders" : h.kind === "product" ? "Products" : "Customers",
    }));
    return [...found, ...QUICK.filter(match), ...pages.filter(match)];
  }, [q, hits, isOwner]);

  useEffect(() => setIndex(0), [rows.length]);

  const go = (r: Row | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[index]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[10svh]">
          <motion.div className="absolute inset-0 bg-aubergine-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.1, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-[3px] border border-ink/20 bg-cream-50 shadow-lift"
            role="dialog"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b border-stone-300/70 px-4">
              <IconSearch className="size-5 text-stone-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Order number, email, product name or page..."
                className="h-14 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-stone-500 focus:outline-none"
              />
              {loading && <span className="size-4 animate-spin rounded-full border-2 border-aubergine-300 border-t-transparent" />}
            </div>
            <div ref={listRef} className="max-h-[55svh] overflow-y-auto p-2" data-lenis-prevent>
              {rows.length === 0 && !loading && (
                <p className="px-3 py-8 text-center text-sm text-ink-soft">Nothing found for &ldquo;{q}&rdquo;. Try an order number like 10023.</p>
              )}
              {rows.map((r, i) => {
                const header = r.group !== lastGroup ? r.group : null;
                lastGroup = r.group;
                return (
                  <div key={r.key}>
                    {header && <p className="px-3 pb-1 pt-3 font-display text-[0.95rem] italic text-stone-500">{header}</p>}
                    <button
                      data-i={i}
                      onMouseMove={() => setIndex(i)}
                      onClick={() => go(r)}
                      className={cn("flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left", i === index ? "bg-aubergine-800 text-cream-50" : "text-ink")}
                    >
                      <r.icon className={cn("size-4 shrink-0", i === index ? "text-gold-300" : "text-aubergine-600")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        {r.subtitle && <span className={cn("block truncate text-xs", i === index ? "text-cream-100/70" : "text-stone-500")}>{r.subtitle}</span>}
                      </span>
                      <IconArrowRight className={cn("size-4", i === index ? "text-gold-300" : "text-stone-300")} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="hidden items-center gap-4 border-t border-stone-300/70 px-4 py-2 text-[0.7rem] text-stone-500 sm:flex">
              <span>Up and down arrows to move</span>
              <span>Enter to open</span>
              <span>Esc to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
