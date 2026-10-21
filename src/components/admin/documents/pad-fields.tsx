"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconSearch } from "@/components/icons";
import { searchManualCustomers } from "@/lib/actions/admin/invoices";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { padDate } from "@/lib/delivery-notes";
import { addressBlock, customerNo, type BillTo, type ManualCustomer } from "@/lib/invoices";
import { cn } from "@/lib/utils";
import { AddressLines, PAD, PadAction, padInput } from "./sheet";

/** A field written straight onto the pad. */
export function PadInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(padInput, "h-[21px] px-1", className)} {...props} />;
}

/** Dropdown and date picker triggers restyled to sit on a printed line. */
const padTrigger =
  "h-[24px] w-full gap-1 rounded-[2px] border-0 bg-transparent px-1 py-0 font-sans text-[length:inherit] text-[#1f2547] shadow-none hover:bg-gold-100/50 focus:bg-gold-100 focus:ring-0 md:h-[24px] md:text-[length:inherit]";

export function PadDate({ value, onChange, label, className, center }: { value: string | null; onChange: (v: string | null) => void; label: string; className?: string; center?: boolean }) {
  return (
    <DatePicker
      value={value}
      onChange={onChange}
      clearable={false}
      icon={false}
      aria-label={label}
      formatValue={(d) => padDate(new Intl.DateTimeFormat("en-CA").format(d))}
      className={className}
      triggerClassName={cn(padTrigger, center && "text-center")}
    />
  );
}

export function PadDropdown(props: React.ComponentProps<typeof Dropdown>) {
  return <Dropdown {...props} className={cn(padTrigger, props.className)} />;
}

type Suggest<T> = {
  search: (q: string) => Promise<T[]>;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
};

/**
 * Suggestions from the database for whatever is typed, a moment after the last key, under the input `anchor`.
 * Used by the search bars on the pads.
 */
function useSuggestions<T>(search: (q: string) => Promise<T[]>, query: string, open: boolean, anchor: React.RefObject<HTMLInputElement | null>, minWidth: number) {
  // Results remember which query they answer, so a list for an earlier query is never shown or picked from.
  const [found, setFound] = useState<{ q: string; items: T[] }>({ q: "", items: [] });
  const [active, setActive] = useState(0);
  const fresh = found.q === query;
  const results = fresh ? found.items : [];
  const loading = open && !fresh;
  const [place, setPlace] = useState<{ left: number; top: number; width: number } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const items = await search(query).catch(() => [] as T[]);
      if (n !== seq.current) return; // a newer search has started
      setFound({ q: query, items });
      setActive(0);
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  // Keep the list glued under the input while the page moves.
  useEffect(() => {
    if (!open) return;
    const follow = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setPlace({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, minWidth) });
    };
    follow();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, anchor, minWidth]);

  /** Arrow keys move; returns true when Enter picked something. */
  const keys = (e: React.KeyboardEvent<HTMLInputElement>, pick: (item: T) => void) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active] && !loading) {
      e.preventDefault();
      pick(results[active]);
      return true;
    }
    return false;
  };

  return { results, loading, active, setActive, place, keys };
}

function SuggestionList<T>({
  id,
  s,
  renderItem,
  itemKey,
  onPick,
  empty,
  footer,
}: {
  id: string;
  s: ReturnType<typeof useSuggestions<T>>;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  onPick: (item: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  if (!s.place) return null;
  return createPortal(
    <div
      id={id}
      role="listbox"
      // Clicking a result must not blur the input first.
      onMouseDown={(e) => e.preventDefault()}
      className="bq-scroll fixed z-[90] max-h-[340px] overflow-y-auto rounded-sm border border-stone-300 bg-cream-50 py-1.5 font-sans shadow-lift"
      style={{ left: s.place.left, top: s.place.top, width: s.place.width }}
    >
      {s.results.map((item, i) => (
        <button
          key={itemKey(item)}
          id={`${id}-${i}`}
          type="button"
          role="option"
          aria-selected={i === s.active}
          onMouseEnter={() => s.setActive(i)}
          onClick={() => onPick(item)}
          className={cn("block w-full px-4 py-2 text-left", i === s.active && "bg-cream-200")}
        >
          {renderItem(item)}
        </button>
      ))}
      {!s.loading && s.results.length === 0 && empty && <div className="px-4 py-2 text-sm text-ink-soft">{empty}</div>}
      {s.loading && s.results.length === 0 && <p className="px-4 py-2 text-sm text-stone-500">Searching</p>}
      {footer && <div className="mt-1 border-t border-ink/10 px-4 pb-1 pt-2">{footer}</div>}
    </div>,
    document.body,
  );
}

/**
 * A search box written onto the pad: type, and what the database finds drops down underneath. Arrow keys and
 * Enter pick, Esc closes. `display` is shown while it isn't being searched.
 */
export function PadSearch<T>({
  search,
  onPick,
  renderItem,
  itemKey,
  display,
  placeholder,
  label,
  footer,
  empty,
  className,
}: Suggest<T> & {
  onPick: (item: T) => void;
  display?: string;
  placeholder: string;
  label: string;
  /** Under the results, e.g. "+ Add a new customer". Gets a function that closes the list. */
  footer?: (close: () => void) => ReactNode;
  empty?: (q: string) => ReactNode;
  className?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const s = useSuggestions(search, query, open, input, 340);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (item: T) => {
    onPick(item);
    close();
    input.current?.blur();
  };

  return (
    <div className={cn("relative", className)}>
      <IconSearch className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && s.results[s.active] ? `${listId}-${s.active}` : undefined}
        aria-label={label}
        value={open ? query : (display ?? "")}
        placeholder={open && display ? display : placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          else s.keys(e, pick);
        }}
        autoComplete="off"
        className={cn(padInput, "h-[24px] pl-1 pr-6")}
      />
      {open && (
        <SuggestionList id={listId} s={s} renderItem={renderItem} itemKey={itemKey} onPick={pick} empty={empty ? empty(query.trim()) : "Nothing found."} footer={footer?.(close)} />
      )}
    </div>
  );
}

/**
 * The Invoice To box. The name line is a search bar: type part of a name, company, email or phone and pick
 * from what the database finds. Their address fills in underneath.
 */
export function CustomerBox({
  customer,
  onChange,
  onAdd,
  orphan,
}: {
  customer: ManualCustomer | null;
  onChange: (c: ManualCustomer) => void;
  /** "Add them as a new customer", offered in the results. */
  onAdd: () => void;
  /** Who a saved document was written for, if they have since been removed from the list. */
  orphan?: BillTo | null;
}) {
  const shown = customer ?? orphan;
  return (
    <>
      <PadSearch
        search={searchManualCustomers}
        onPick={onChange}
        itemKey={(c) => c.id}
        display={shown?.full_name}
        placeholder="Search customers by name or number"
        label="Invoice to: search customers"
        className="-ml-1 w-[calc(100%+0.5rem)] text-[15px] font-semibold"
        renderItem={(c) => (
          <>
            <span className={cn("block truncate text-[0.95rem] text-ink", c.id === customer?.id && "font-medium text-aubergine-800")}>{c.full_name}</span>
            <span className="block truncate text-sm text-ink-soft">{[customerNo(c.number), c.company, c.phone].filter(Boolean).join(" · ")}</span>
          </>
        )}
        empty={(q) => (q ? `No customer matches \u201c${q}\u201d.` : "No customers yet.")}
        footer={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              onAdd();
            }}
            className="text-sm text-aubergine-700 underline-offset-2 hover:underline"
          >
            + Add a new customer
          </button>
        )}
      />
      <AddressLines lines={addressBlock(shown)} skipFirst />
      {orphan && !customer && <p className="mt-1 font-sans text-xs italic text-stone-500">Removed from the list. Search for another to change it.</p>}
    </>
  );
}

/** The Deliver To box: written freely, one line per line of the address. */
export function DeliverToBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Deliver to"
      placeholder={"Address, one line each\nor just: Collected"}
      className={cn(padInput, "bq-scroll -mx-1 h-full w-[calc(100%+0.5rem)] resize-none px-1 text-[15px] leading-[20px]")}
      style={{ color: PAD.pen }}
    />
  );
}

/** "Collected" and "Same as invoice" beside the Deliver To label. */
export function DeliverToActions({ onPick, invoiceAddress }: { onPick: (v: string) => void; invoiceAddress: string[] }) {
  return (
    <>
      <PadAction onClick={() => onPick("Collected")}>Collected</PadAction>
      <PadAction onClick={() => onPick(invoiceAddress.join("\n"))} disabled={!invoiceAddress.length}>
        Same as invoice
      </PadAction>
    </>
  );
}

/** Takes a line off the sheet; sits in the sheet's right margin, beside its line. */
export function RemoveLine({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-5 place-items-center rounded-[2px] text-stone-500/70 hover:bg-danger/10 hover:text-danger focus-visible:text-danger disabled:invisible"
    >
      <IconClose className="size-3.5" />
    </button>
  );
}
