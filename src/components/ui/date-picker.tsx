"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClose } from "@/components/icons";
import { inputClasses } from "./input";
import { cn } from "@/lib/utils";

/** yyyy-mm-dd helpers in local time (dates here are calendar days, not instants) */
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s: string | null | undefined) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && toISO(a) === toISO(b);
const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (iso: string | null) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** Bespoke calendar. Anchored panel on larger screens, bottom sheet on phones. */
export function DatePicker({
  value,
  defaultValue = null,
  onChange,
  name,
  id,
  min,
  max,
  placeholder = "Choose a date",
  clearable = true,
  disabled,
  className,
  ...aria
}: Props) {
  const auto = useId();
  const triggerId = id ?? `dp-${auto}`;
  const [inner, setInner] = useState<string | null>(defaultValue);
  const current = value !== undefined ? value : inner;
  const selected = fromISO(current);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [view, setView] = useState(() => selected ?? new Date());
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date());
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const minD = fromISO(min);
  const maxD = fromISO(max);

  const set = (d: Date | null) => {
    const iso = d ? toISO(d) : null;
    if (value === undefined) setInner(iso);
    onChange?.(iso);
  };

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const blocked = (d: Date) => (minD && d < minD) || (maxD && d > maxD);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toISO(focusDay)}"]`)?.focus({ preventScroll: true });
  }, [open, focusDay]);

  const shift = (n: number) => {
    const d = new Date(focusDay);
    d.setDate(d.getDate() + n);
    setFocusDay(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") shift(1);
    else if (k === "ArrowLeft") shift(-1);
    else if (k === "ArrowDown") shift(7);
    else if (k === "ArrowUp") shift(-7);
    else if (k === "PageDown") shift(30);
    else if (k === "PageUp") shift(-30);
    else if (k === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  const panel = (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="grid size-11 place-items-center rounded-sm hover:bg-cream-200">
          <IconChevronLeft className="size-4" />
        </button>
        <p className="font-display text-xl" aria-live="polite">{monthFmt.format(view)}</p>
        <button type="button" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="grid size-11 place-items-center rounded-sm hover:bg-cream-200">
          <IconChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center font-serif text-sm italic text-ink-soft">
        {WEEKDAYS.map((w, i) => <span key={i} className="py-1.5">{w}</span>)}
      </div>
      <div ref={grid} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const out = d.getMonth() !== view.getMonth();
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, new Date());
          const off = blocked(d);
          return (
            <button
              key={toISO(d)}
              type="button"
              data-day={toISO(d)}
              tabIndex={sameDay(d, focusDay) ? 0 : -1}
              disabled={!!off}
              aria-pressed={isSel}
              aria-label={fmt.format(d)}
              onClick={() => { set(d); setFocusDay(d); setOpen(false); }}
              className={cn(
                "relative mx-auto grid size-10 place-items-center rounded-sm text-[0.95rem] tabular-nums transition-colors",
                out ? "text-stone-500/70" : "text-ink",
                !isSel && !off && "hover:bg-cream-200",
                isSel && "bg-aubergine-700 text-cream-50",
                off && "cursor-not-allowed opacity-30 line-through",
              )}
            >
              {d.getDate()}
              {isToday && !isSel && <span className="absolute bottom-1 h-px w-3 bg-gold-500" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-stone-300/70 pt-3 text-sm">
        <button type="button" className="min-h-11 px-1 text-aubergine-700 underline-offset-4 hover:underline" onClick={() => { const t = new Date(); if (!blocked(t)) { set(t); setOpen(false); } else { setView(t); } }}>
          Today
        </button>
        {clearable && current && (
          <button type="button" className="min-h-11 px-1 text-ink-soft underline-offset-4 hover:underline" onClick={() => { set(null); setOpen(false); }}>
            Clear date
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
        onClick={() => { if (!open) { setMobile(window.matchMedia("(max-width: 639px)").matches); setView(selected ?? new Date()); setFocusDay(selected ?? new Date()); } setOpen(!open); }}
        className={cn(inputClasses, "flex h-12 items-center gap-3 text-left md:h-11", open && "border-aubergine-500 ring-3 ring-aubergine-300/35")}
      >
        <IconCalendar className="size-[18px] shrink-0 text-ink-soft" />
        <span className={cn("flex-1 truncate", !selected && "text-stone-500")}>{selected ? fmt.format(selected) : placeholder}</span>
      </button>
      {name && <input type="hidden" name={name} value={current ?? ""} />}

      <AnimatePresence>
        {open && mobile && (
            <div key="sheet" className="fixed inset-0 z-[90]">
              <motion.div className="absolute inset-0 bg-aubergine-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
              <motion.div
                role="dialog"
                aria-label="Choose a date"
                className="absolute inset-x-0 bottom-0 rounded-t-md bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-lift"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.45, ease: [0.2, 0.7, 0.1, 1] }}
              >
                <div className="flex justify-end px-2 pt-2">
                  <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-11 place-items-center"><IconClose className="size-5" /></button>
                </div>
                {panel}
              </motion.div>
            </div>
        )}
        {open && !mobile && (
            <motion.div
              key="anchored"
              role="dialog"
              aria-label="Choose a date"
              className="absolute left-0 top-full z-[90] mt-1.5 w-[320px] rounded-sm border border-stone-300 bg-cream-50 shadow-lift"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {panel}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
