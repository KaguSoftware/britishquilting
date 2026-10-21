"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconMore } from "@/components/icons";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  /** A link (opens a page), or */
  href?: string;
  /** "_blank" to open in a new tab */
  target?: string;
  /** an action. */
  onSelect?: () => void;
  danger?: boolean;
};

const MOBILE = "(max-width: 639px)";

/**
 * The "⋯" button at the end of a row, holding the row's less used actions. Anchored popover on larger screens,
 * bottom sheet on phones. Keyboard: arrows/Home/End move, Enter/Space choose, Esc closes.
 */
export function Menu({ items, label, title }: { items: MenuItem[]; label: string; title?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [rect, setRect] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < items.length * 44 + 24 && r.top > below;
    setRect({ top: up ? r.top - 6 : r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), up });
    if (r.bottom < 0 || r.top > window.innerHeight) setOpen(false);
  }, [items.length]);

  const show = () => {
    setMobile(window.matchMedia(MOBILE).matches);
    place();
    setActive(0);
    setOpen(true);
  };
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || mobile) return;
    const on = () => place();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open, mobile, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) close(false);
    };
    // Esc closes it wherever focus is, even if it never left the button.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onEsc);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-index="0"]`)?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, close]);

  const focusItem = (i: number) => {
    const n = (i + items.length) % items.length;
    setActive(n);
    list.current?.querySelector<HTMLElement>(`[data-index="${n}"]`)?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); focusItem(active + 1); break;
      case "ArrowUp": e.preventDefault(); focusItem(active - 1); break;
      case "Home": e.preventDefault(); focusItem(0); break;
      case "End": e.preventDefault(); focusItem(items.length - 1); break;
      case "Tab": close(false); break;
    }
  };

  const itemClass = (i: number, danger?: boolean) =>
    cn(
      "flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-[0.95rem] outline-none transition-colors",
      i === active && "bg-cream-200/80",
      danger ? "text-danger" : "text-ink",
    );

  const menu = (
    <div ref={list} id={id} role="menu" aria-label={label} onKeyDown={onKey} className="py-1.5">
      {items.map((it, i) => {
        const inner = (
          <>
            {it.icon && <span className="grid size-4 shrink-0 place-items-center text-ink-soft [&>svg]:size-4">{it.icon}</span>}
            <span className="truncate">{it.label}</span>
          </>
        );
        const common = {
          role: "menuitem" as const,
          tabIndex: i === active ? 0 : -1,
          "data-index": i,
          onPointerMove: () => setActive(i),
          className: itemClass(i, it.danger),
        };
        // Pages in the back office go through the router; tel:, mailto: and new tabs are plain links.
        return it.href && it.href.startsWith("/") && !it.target ? (
          <Link key={it.label} href={it.href} onClick={() => close(false)} {...common}>
            {inner}
          </Link>
        ) : it.href ? (
          <a key={it.label} href={it.href} target={it.target} onClick={() => close(false)} {...common}>
            {inner}
          </a>
        ) : (
          <button
            key={it.label}
            type="button"
            onClick={() => {
              close(false);
              it.onSelect?.();
            }}
            {...common}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "Enter", " "].includes(e.key) && !open) {
            e.preventDefault();
            show();
          } else if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            focusItem(0);
          }
        }}
        className={cn("grid size-10 place-items-center rounded-sm text-ink-soft transition-colors hover:bg-cream-200 hover:text-ink lg:size-8", open && "bg-cream-200 text-ink")}
      >
        <IconMore className="size-5" />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open &&
              (mobile ? (
                <div className="fixed inset-0 z-[90]" key="sheet">
                  <motion.div className="absolute inset-0 bg-aubergine-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close()} />
                  <motion.div
                    role="dialog"
                    aria-label={title ?? label}
                    className="absolute inset-x-0 bottom-0 rounded-t-md bg-cream-50 pb-[max(env(safe-area-inset-bottom),12px)] shadow-lift"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={still ? { duration: 0 } : { type: "tween", duration: 0.45, ease: [0.2, 0.7, 0.1, 1] }}
                  >
                    <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-stone-300" />
                    {title && <p className="font-display truncate px-4 pb-1 pt-3 text-2xl">{title}</p>}
                    <div className="stitch mx-4 my-2 opacity-50" />
                    {menu}
                  </motion.div>
                </div>
              ) : (
                rect && (
                  <motion.div
                    key="pop"
                    className="fixed z-[90] min-w-52 overflow-hidden rounded-sm border border-stone-300 bg-cream-50 shadow-lift"
                    style={{ right: rect.right, ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }), transformOrigin: rect.up ? "bottom right" : "top right" }}
                    initial={{ opacity: 0, scale: 0.97, y: rect.up ? 4 : -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={still ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.7, 0.1, 1] }}
                  >
                    {menu}
                  </motion.div>
                )
              ))}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
