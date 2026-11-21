"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight, IconSpinner } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { londonDay, type PeriodKey } from "@/lib/finance/calc";
import { Button, Field } from "../ui";
import { Modal } from "../controls";

const OPTIONS: { key: PeriodKey; label: string; hint: string }[] = [
  { key: "month", label: "This month", hint: "From the 1st to today" },
  { key: "last_month", label: "Last month", hint: "The whole of last month" },
  { key: "quarter", label: "Quarter", hint: "Three months, for VAT returns. Use the arrows for earlier quarters" },
  { key: "year", label: "This year", hint: "1 January to 31 December" },
  { key: "tax_year", label: "Tax year", hint: "6 April to 5 April, for Self Assessment" },
  { key: "custom", label: "Choose dates", hint: "Any range you like" },
];

export function PeriodPicker({
  current,
  label,
  previousLabel,
  from,
  to,
  onQuickSelect,
  quickPending,
  onStep,
  canStepForward,
  onPickQuarter,
}: {
  current: PeriodKey;
  label: string;
  previousLabel: string;
  from: string;
  to: string;
  /** When given, a click on a non-custom tab goes through this (an instant, locally-cached switch) instead of a full navigation. */
  onQuickSelect?: (key: Exclude<PeriodKey, "custom">) => void;
  /** Set by the caller while an uncached quick-pick is still loading, so the trigger button's spinner reflects it too. */
  quickPending?: boolean;
  /** Step to the period before (-1) or after (+1); shown as arrows either side of the period. */
  onStep?: (dir: -1 | 1) => void;
  canStepForward?: boolean;
  /** When showing a quarter: jump straight to any quarter of the year. */
  onPickQuarter?: (year: number, q: number) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [navPending, start] = useTransition();
  const pending = navPending || Boolean(quickPending);
  const [custom, setCustom] = useState(current === "custom");
  const [a, setA] = useState<string | null>(from);
  const [b, setB] = useState<string | null>(to);

  const go = (key: PeriodKey, range?: { from: string; to: string }) => {
    if (!range && key !== "custom" && onQuickSelect) {
      setOpen(false);
      onQuickSelect(key);
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.delete("expense");
    q.set("p", key);
    if (range) {
      q.set("from", range.from);
      q.set("to", range.to);
    } else {
      q.delete("from");
      q.delete("to");
    }
    setOpen(false);
    start(() => router.push(`/admin/finance?${q.toString()}`, { scroll: false }));
  };

  const fromYear = Number(from.slice(0, 4));
  const fromQ = Math.floor((Number(from.slice(5, 7)) - 1) / 3) + 1;
  const today = londonDay(new Date());
  const nowQ = Math.floor((today.m - 1) / 3) + 1;
  const arrow =
    "grid size-12 shrink-0 place-items-center rounded-sm border border-stone-300 bg-cream-50 text-aubergine-800 transition-colors hover:border-aubergine-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-stone-300 disabled:hover:bg-cream-50";

  return (
    <>
    <div
      className="sticky top-[73px] z-30 -mx-4 mb-8 border-b border-ink/15 bg-cream-100/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10"
      onKeyDown={(e) => {
        // Left and right arrow keys step while the bar has focus.
        if (!onStep || (e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
        if (e.key === "ArrowLeft") onStep(-1);
        else if (e.key === "ArrowRight" && canStepForward) onStep(1);
      }}
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3">
        {onStep && (
          <button type="button" onClick={() => onStep(-1)} className={arrow} aria-label={`Show the period before ${label}`} title="Earlier (left arrow key)">
            <IconChevronLeft className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm border border-stone-300 bg-cream-50 px-3.5 text-left transition-colors hover:border-aubergine-300 sm:flex-none sm:pr-5"
          aria-haspopup="dialog"
        >
          <IconCalendar className="size-5 shrink-0 text-gold-600" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[1.15rem] leading-tight text-aubergine-900">{label}</span>
            <span className="block truncate text-xs text-stone-500">Compared with {previousLabel}</span>
          </span>
          {pending ? <IconSpinner className="size-4 text-stone-500" /> : <IconChevronDown className="size-4 text-stone-500" />}
        </button>
        {onStep && (
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={!canStepForward}
            className={arrow}
            aria-label={`Show the period after ${label}`}
            title={canStepForward ? "Later (right arrow key)" : "This is the latest"}
          >
            <IconChevronRight className="size-5" />
          </button>
        )}
        <div className="hidden flex-wrap gap-1 lg:flex">
          {OPTIONS.filter((o) => o.key !== "custom").map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => go(o.key)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm transition-colors",
                current === o.key ? "bg-aubergine-800 text-cream-50" : "text-ink-soft hover:bg-cream-200 hover:text-ink",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {onPickQuarter && (
          <div className="flex w-full items-stretch border-t border-ink/10 pt-3 lg:w-auto lg:border-t-0 lg:pt-0 xl:ml-auto" role="group" aria-label={`Quarters of ${fromYear}`}>
            <span className="mr-3 self-center font-display text-lg tabular-nums text-aubergine-900">{fromYear}</span>
            {[1, 2, 3, 4].map((q) => {
              const future = fromYear > today.y || (fromYear === today.y && q > nowQ);
              const on = q === fromQ;
              const months = ["Jan to Mar", "Apr to Jun", "Jul to Sep", "Oct to Dec"][q - 1];
              return (
                <button
                  key={q}
                  type="button"
                  disabled={future}
                  onClick={() => onPickQuarter(fromYear, q)}
                  aria-pressed={on}
                  className={cn(
                    "flex-1 border-y border-l border-stone-300 px-3 py-1.5 text-left transition-colors last:border-r first:rounded-l-sm last:rounded-r-sm lg:flex-none",
                    on ? "bg-aubergine-800 text-cream-50" : "bg-cream-50 text-ink hover:bg-white",
                    future && "cursor-not-allowed text-stone-500/60 hover:bg-cream-50",
                  )}
                >
                  <span className="block text-sm font-medium tabular-nums">Q{q}</span>
                  <span className={cn("block text-[0.7rem]", on ? "text-cream-100/80" : "text-stone-500")}>{months}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Which dates?" description="Takings count on the day they were paid, refunds on the day they were made. UK time.">
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {OPTIONS.map((o) => {
            const on = o.key === "custom" ? custom : current === o.key && !custom;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => (o.key === "custom" ? setCustom(true) : go(o.key))}
                  className={cn("flex min-h-14 w-full items-center gap-3 px-1 py-2.5 text-left", on && "shadow-[inset_3px_0_0_var(--color-aubergine-700)] pl-4")}
                  aria-pressed={on}
                >
                  <span className="flex-1">
                    <span className={cn("block text-[0.95rem]", on ? "font-medium text-aubergine-900" : "text-ink")}>{o.label}</span>
                    <span className="block text-xs text-stone-500">{o.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {custom && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="From">
              <DatePicker value={a} onChange={setA} clearable={false} aria-label="From" />
            </Field>
            <Field label="To">
              <DatePicker value={b} onChange={setB} clearable={false} min={a ?? undefined} aria-label="To" />
            </Field>
            <Button className="sm:col-span-2" disabled={!a || !b} onClick={() => a && b && go("custom", { from: a, to: b })}>
              Show these dates
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
