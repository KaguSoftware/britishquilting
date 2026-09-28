"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconCheck, IconChevronDown } from "@/components/icons";
import { inputClasses } from "./input";
import { cn } from "@/lib/utils";

export type DropdownOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** plain text used for type-ahead and the trigger when label is rich */
  text?: string;
  hint?: ReactNode;
  disabled?: boolean;
};

type Props<V extends string> = {
  options: DropdownOption<V>[];
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (value: V) => void;
  /** set to submit with a plain <form> (renders a hidden input) */
  name?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** compact trigger for toolbars (e.g. sort) */
  size?: "md" | "sm";
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** title shown at the top of the mobile sheet */
  sheetTitle?: string;
};

const MOBILE = "(max-width: 639px)";

/**
 * Bespoke select. Anchored popover on larger screens, bottom sheet on phones.
 * Keyboard: arrows/Home/End move, Enter/Space choose, Esc closes, typing jumps.
 */
export function Dropdown<V extends string = string>({
  options,
  value,
  defaultValue = null,
  onChange,
  name,
  placeholder = "Choose…",
  id,
  disabled,
  required,
  className,
  size = "md",
  sheetTitle,
  ...aria
}: Props<V>) {
  const autoId = useId();
  const triggerId = id ?? `dd-${autoId}`;
  const listId = `${triggerId}-list`;
  const [inner, setInner] = useState<V | null>(defaultValue);
  const current = value !== undefined ? value : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ q: "", t: 0 });
  const still = useReducedMotion();

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === current), [options, current]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 280 && r.top > spaceBelow;
    const width = Math.max(r.width, 180);
    // keep the panel on screen when the trigger sits near the right edge
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setRect({ top: up ? r.top - 6 : r.bottom + 6, left, width, up });
    // close once the trigger scrolls fully out of view (e.g. inside a drawer)
    if (r.bottom < 0 || r.top > window.innerHeight) setOpen(false);
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    setMobile(window.matchMedia(MOBILE).matches);
    place();
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  }, [disabled, place, selectedIndex]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  const choose = useCallback(
    (i: number) => {
      const o = options[i];
      if (!o || o.disabled) return;
      if (value === undefined) setInner(o.value);
      onChange?.(o.value);
      close();
    },
    [options, value, onChange, close],
  );

  // Keep the popover glued to the trigger while the page moves.
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
    document.addEventListener("pointerdown", onDown);
    requestAnimationFrame(() => list.current?.focus({ preventScroll: true }));
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (dir: 1 | -1, from = active) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return setActive(i);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "Home": e.preventDefault(); move(1, -1); break;
      case "End": e.preventDefault(); move(-1, options.length); break;
      case "Enter":
      case " ": e.preventDefault(); choose(active); break;
      case "Escape": e.preventDefault(); e.stopPropagation(); close(); break;
      case "Tab": close(false); break;
      default:
        if (e.key.length === 1) {
          const now = Date.now();
          typed.current.q = (now - typed.current.t > 700 ? "" : typed.current.q) + e.key.toLowerCase();
          typed.current.t = now;
          const hit = options.findIndex((o) => !o.disabled && (o.text ?? String(o.label)).toLowerCase().startsWith(typed.current.q));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const listbox = (
    <ul
      ref={list}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-labelledby={triggerId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      onKeyDown={onListKey}
      data-lenis-prevent
      className="bq-scroll max-h-[min(60vh,320px)] overflow-y-auto py-1.5 outline-none"
    >
      {options.map((o, i) => {
        const isSel = o.value === current;
        return (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            data-index={i}
            role="option"
            aria-selected={isSel}
            aria-disabled={o.disabled || undefined}
            onPointerMove={() => !o.disabled && setActive(i)}
            onClick={() => choose(i)}
            className={cn(
              "relative flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 text-[0.95rem] transition-colors",
              i === active && "bg-cream-200/80",
              isSel && "text-aubergine-800",
              o.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            <span className={cn("absolute inset-y-2 left-0 w-0.5 bg-aubergine-700 transition-opacity", isSel ? "opacity-100" : "opacity-0")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block text-sm text-ink-soft">{o.hint}</span>}
            </span>
            <IconCheck className={cn("size-4 shrink-0 text-aubergine-700 transition-opacity", isSel ? "opacity-100" : "opacity-0")} />
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={aria["aria-invalid"]}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cn(
          inputClasses,
          "flex items-center justify-between gap-3 text-left",
          size === "md" ? "h-12 md:h-11" : "h-10 w-auto",
          open && "border-aubergine-500 ring-3 ring-aubergine-300/35",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-stone-500")}>{selected ? (selected.text ?? selected.label) : placeholder}</span>
        <IconChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-300 ease-(--ease-silk)", open && "rotate-180")} />
      </button>
      {name &&
        (required ? (
          // focusable-by-validation only, so the browser blocks an empty submit
          <input tabIndex={-1} aria-hidden className="sr-only" name={name} value={current ?? ""} required onChange={() => {}} onFocus={() => trigger.current?.focus()} />
        ) : (
          <input type="hidden" name={name} value={current ?? ""} />
        ))}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open &&
              (mobile ? (
                <div className="fixed inset-0 z-[90]" key="sheet">
                  <motion.div
                    className="absolute inset-0 bg-aubergine-950/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => close()}
                  />
                  <motion.div
                    role="dialog"
                    aria-label={sheetTitle ?? aria["aria-label"] ?? "Choose an option"}
                    className="absolute inset-x-0 bottom-0 rounded-t-md bg-cream-50 pb-[max(env(safe-area-inset-bottom),12px)] shadow-lift"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={still ? { duration: 0 } : { type: "tween", duration: 0.45, ease: [0.2, 0.7, 0.1, 1] }}
                  >
                    <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-stone-300" />
                    {sheetTitle && <p className="font-display px-4 pb-1 pt-3 text-2xl">{sheetTitle}</p>}
                    <div className="stitch mx-4 my-2 opacity-50" />
                    {listbox}
                  </motion.div>
                </div>
              ) : (
                rect && (
                  <motion.div
                    key="pop"
                    className="fixed z-[90] overflow-hidden rounded-sm border border-stone-300 bg-cream-50 shadow-lift"
                    style={{
                      left: rect.left,
                      width: rect.width,
                      ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
                      transformOrigin: rect.up ? "bottom" : "top",
                    }}
                    initial={{ opacity: 0, scaleY: 0.96, y: rect.up ? 4 : -4 }}
                    animate={{ opacity: 1, scaleY: 1, y: 0 }}
                    exit={{ opacity: 0, scaleY: 0.97 }}
                    transition={still ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.7, 0.1, 1] }}
                  >
                    {listbox}
                  </motion.div>
                )
              ))}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
