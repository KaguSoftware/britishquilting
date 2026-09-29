"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { IconClose, IconWarning } from "@/components/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/admin/types";
import { Button } from "./ui";

/* ───────────────────────── Switch */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
        size === "md" ? "h-6 w-11" : "h-5 w-9",
        checked ? "bg-aubergine-700" : "bg-stone-300",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-cream-50 shadow-sm transition-transform duration-200 ease-(--ease-silk)",
          size === "md" ? "size-5" : "size-4",
          checked ? (size === "md" ? "translate-x-5.5" : "translate-x-4.5") : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SwitchRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-sm border border-stone-300/70 bg-white/60 px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-stone-500">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} />
    </label>
  );
}

/* ───────────────────────── Segmented control */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-sm border border-stone-300 bg-cream-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative flex flex-1 items-center justify-center gap-2 rounded-[3px] px-4 py-2 text-sm font-medium transition-colors",
            value === o.value ? "text-cream-50" : "text-ink-soft hover:text-ink",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 rounded-[3px] bg-aubergine-800 shadow-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
          )}
          <span className="relative flex items-center gap-2">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Modal */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-aubergine-950/45 "
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.1, 1] }}
            className={cn(
              "relative max-h-[92svh] w-full overflow-y-auto rounded-t-[4px] border border-ink/15 bg-cream-50 shadow-lift sm:rounded-[3px]",
              wide ? "sm:max-w-2xl" : "sm:max-w-md",
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <h2 className="font-display text-2xl leading-tight text-aubergine-900">{title}</h2>
                {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
              </div>
              <button onClick={onClose} className="-mr-2 -mt-1 rounded-sm p-2 text-stone-500 hover:bg-cream-200 hover:text-ink" aria-label="Close">
                <IconClose className="size-5" />
              </button>
            </div>
            <div className="px-6 pb-6 pt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────── Confirm dialog (promise based) */
type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ""}>
        {state && (
          <div>
            <div className="flex gap-3">
              {state.danger && (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
                  <IconWarning className="size-5" />
                </span>
              )}
              {state.description && <div className="text-[0.95rem] leading-relaxed text-ink-soft">{state.description}</div>}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel ?? "Go back"}
              </Button>
              <Button variant={state.danger ? "danger" : "primary"} className={state.danger ? "!bg-danger !text-cream-50" : ""} onClick={() => close(true)} autoFocus>
                {state.confirmLabel ?? "Yes, continue"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

/* ───────────────────────── Run a server action with toasts + refresh */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(
      fn: () => Promise<ActionResult<T>>,
      opts: { success?: string; undo?: () => Promise<ActionResult<unknown>>; onDone?: (data?: T) => void } = {},
    ) =>
      new Promise<ActionResult<T>>((resolve) => {
        start(async () => {
          try {
            const res = await fn();
            if (!res.ok) {
              toast.error(res.error);
            } else {
              const msg = res.message ?? opts.success;
              if (msg) {
                toast.success(msg, opts.undo
                  ? {
                      action: {
                        label: "Undo",
                        onClick: async () => {
                          const u = await opts.undo!();
                          if (u.ok) toast("Undone");
                          else toast.error(u.error);
                          router.refresh();
                        },
                      },
                      duration: 7000,
                    }
                  : undefined);
              }
              opts.onDone?.(res.data);
              router.refresh();
            }
            resolve(res);
          } catch (e) {
            console.error(e);
            toast.error("Something went wrong. Please try again.");
            resolve({ ok: false, error: "Something went wrong." });
          }
        });
      }),
    [router],
  );
  return { run, pending };
}


/* ───────────────────────── Unsaved changes guard */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!window.confirm("You have changes that aren't saved yet. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

/* ───────────────────────── Sticky save bar */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Save changes",
  extra,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-8 lg:bottom-4">
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[3px] border px-4 py-3 shadow-lift transition-colors",
          dirty ? "border-aubergine-950 bg-aubergine-900 text-cream-50" : "border-ink/15 bg-cream-50 text-ink-soft",
        )}
      >
        <p className="flex items-center gap-2 text-sm">
          <span className={cn("size-2 rounded-full", dirty ? "animate-pulse bg-gold-500" : "bg-success")} />
          {dirty ? "You have unsaved changes" : "All changes saved"}
        </p>
        <div className="flex items-center gap-2">
          {extra}
          {dirty && onDiscard && (
            <Button variant="ghost" size="sm" className="text-cream-100 hover:bg-white/10 hover:text-white" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button variant={dirty ? "gold" : "secondary"} onClick={onSave} disabled={saving || !dirty}>
            {saving ? "Saving..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
