"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { IconClose } from "@/components/icons";
import { Crown } from "./brand";

/**
 * Right-hand slide-in menu. Choreography adapted from React Bits' StaggeredMenu:
 * aubergine and gold layers sweep in first, then the cream panel, then each link
 * rises out of its own mask.
 */
export function MobileMenu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: { href: string; label: string }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set("[data-layer], [data-panel]", { xPercent: 100 });
      tl.current = gsap
        .timeline({ paused: true })
        .set(root.current, { visibility: "visible" })
        .to("[data-scrim]", { opacity: 1, duration: 0.4, ease: "power2.out" }, 0)
        .to("[data-layer]", { xPercent: 0, duration: 0.5, ease: "power4.out", stagger: 0.07 }, 0)
        .to("[data-panel]", { xPercent: 0, duration: 0.65, ease: "power4.out" }, 0.18)
        .fromTo("[data-item]", { yPercent: 130, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 0.9, ease: "power4.out", stagger: 0.07 }, 0.3)
        .fromTo("[data-num]", { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.07 }, 0.4)
        .fromTo("[data-foot]", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55);
    }, root);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    if (open) {
      t.timeScale(1).play();
      document.documentElement.style.overflow = "hidden";
    } else {
      t.timeScale(1.6).reverse();
      document.documentElement.style.overflow = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      ref={root}
      className="invisible fixed inset-0 z-[80] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      aria-hidden={!open}
    >
      <button data-scrim aria-label="Close menu" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-aubergine-950/50 opacity-0" />
      <div data-layer className="absolute inset-y-0 right-0 w-[min(88vw,420px)] bg-aubergine-800" />
      <div data-layer className="absolute inset-y-0 right-0 w-[min(88vw,420px)] bg-gold-500" />
      <nav
        data-panel
        aria-label="Mobile"
        data-lenis-prevent
        className="absolute inset-y-0 right-0 flex w-[min(88vw,420px)] flex-col overflow-y-auto bg-cream-50 px-8 pb-10 pt-6"
      >
        <div className="flex items-center justify-between">
          <Crown className="h-5 w-auto text-gold-600" />
          <button onClick={onClose} aria-label="Close menu" tabIndex={open ? 0 : -1} className="-mr-2 grid size-11 place-items-center">
            <IconClose className="size-6" />
          </button>
        </div>

        <ul className="mt-12 space-y-1">
          {items.map((n, i) => (
            <li key={n.href} className="flex items-baseline gap-4 overflow-hidden border-b border-stone-300/70">
              <span data-num className="w-6 font-display text-sm italic text-gold-600">{i + 1}</span>
              <Link
                data-item
                href={n.href}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
                className="font-display block origin-bottom-left py-3.5 text-[2.6rem] leading-none text-aubergine-900"
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <div data-foot className="mt-auto space-y-4 pt-12 text-sm text-ink-soft">
          <div className="flex gap-6">
            <Link href="/account" onClick={onClose} tabIndex={open ? 0 : -1} className="text-ink underline-offset-4 hover:underline">Your account</Link>
            <Link href="/track" onClick={onClose} tabIndex={open ? 0 : -1} className="text-ink underline-offset-4 hover:underline">Track an order</Link>
          </div>
          <p>
            07710 131416 · <a href="mailto:mustafa@britishquilting.com" className="underline-offset-4 hover:underline">mustafa@britishquilting.com</a>
          </p>
        </div>
      </nav>
    </div>
  );
}
