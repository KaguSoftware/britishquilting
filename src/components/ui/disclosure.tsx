"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Accessible show/hide section, replacing the native details/summary pair.
 * A real button (aria-expanded, aria-controls) toggles a region whose height
 * animates open; reduced motion skips the animation.
 *
 *   <Disclosure summary="Have a discount code?" defaultOpen={false}>...</Disclosure>
 *
 * `summary` is the button content, `className` wraps the whole block,
 * `buttonClassName` / `panelClassName` / `iconClassName` style the parts. Pass `open` and
 * `onOpenChange` to control it.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  buttonClassName,
  panelClassName,
  iconClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  iconClassName?: string;
}) {
  const id = useId();
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const still = useReducedMotion();
  const toggle = () => {
    if (openProp === undefined) setInner(!open);
    onOpenChange?.(!open);
  };

  return (
    <div className={className} data-open={open || undefined}>
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={toggle}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <IconChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-300 ease-(--ease-silk) motion-reduce:transition-none", iconClassName, open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-btn`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={still ? { duration: 0 } : { duration: 0.32, ease: [0.2, 0.7, 0.1, 1] }}
            className="overflow-hidden"
          >
            <div className={panelClassName}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
