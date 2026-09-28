"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose } from "@/components/icons";

const setOffset = (px: number) => document.documentElement.style.setProperty("--announce-offset", `${Math.max(0, px)}px`);

export function AnnouncementBar({ message, storageKey }: { message: string; storageKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let hidden = false;
    try {
      hidden = localStorage.getItem(storageKey) === message;
    } catch {
      /* storage blocked: just show it */
    }
    if (hidden) {
      setDismissed(true);
      setOffset(0);
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.hidden = false;
    const update = () => setOffset(el.offsetHeight - window.scrollY);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [message, storageKey]);

  if (dismissed) return null;

  return (
    <div
      ref={ref}
      suppressHydrationWarning
      role="region"
      aria-label="Store announcement"
      className="relative z-[51] border-b border-cream-50/10 bg-aubergine-950 text-cream-100"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-11 md:px-12">
        <p className="truncate text-center text-[0.8rem] tracking-[0.01em] md:text-[0.85rem]" title={message}>
          <span aria-hidden className="mr-2 hidden h-px md:inline-block w-4 translate-y-[-0.28em] border-t border-dashed border-gold-500/80" />
          {message}
          <span aria-hidden className="ml-2 hidden h-px md:inline-block w-4 translate-y-[-0.28em] border-t border-dashed border-gold-500/80" />
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, message);
            } catch {
              /* ignore */
            }
            setOffset(0);
            setDismissed(true);
          }}
          aria-label="Dismiss announcement"
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-cream-100/60 transition-colors hover:text-cream-50 md:right-3"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  );
}
