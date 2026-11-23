"use client";

import { Fragment, useEffect, useRef } from "react";
import { Marquee } from "./marquee";

const setOffset = (px: number) => document.documentElement.style.setProperty("--announce-offset", `${Math.max(0, px)}px`);

export function AnnouncementBar({ messages, together }: { messages: string[]; together: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOffset(el.offsetHeight - window.scrollY);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Store announcement"
      className="relative z-[51] animate-announce-pulse border-b border-cream-50/10 bg-aubergine-950 text-cream-100"
    >
      {together ? (
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-center overflow-hidden px-4 md:px-12">
          <p className="flex items-center whitespace-nowrap text-[0.8rem] tracking-[0.01em] md:text-[0.85rem]">
            {messages.map((m, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden className="mx-4 inline-block h-px w-5 shrink-0 translate-y-[-0.28em] border-t border-dashed border-gold-500/80 md:mx-6" />}
                <span>{m}</span>
              </Fragment>
            ))}
          </p>
        </div>
      ) : (
        <Marquee messages={messages} className="h-9 items-center text-[0.8rem] tracking-[0.01em] md:text-[0.85rem]" />
      )}
    </div>
  );
}
