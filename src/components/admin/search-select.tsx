"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SuggestionList, useSuggestions, type Suggest } from "./documents/pad-fields";
import { inputClass } from "./ui";

/**
 * An admin input that searches the database as you type and drops the matches underneath. Arrow keys and
 * Enter pick, Esc closes. `display` is shown while it isn't being searched.
 */
export function SearchSelect<T>({
  id,
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
  id?: string;
  onPick: (item: T) => void;
  display?: string | null;
  placeholder: string;
  label: string;
  footer?: (close: () => void) => ReactNode;
  empty?: (q: string) => ReactNode;
  className?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const s = useSuggestions(search, query, open, input, 280);

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
      <IconSearch className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
      <input
        id={id}
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
        className={cn(inputClass, "pr-9")}
      />
      {open && (
        <SuggestionList id={listId} s={s} renderItem={renderItem} itemKey={itemKey} onPick={pick} empty={empty ? empty(query.trim()) : "Nothing found."} footer={footer?.(close)} />
      )}
    </div>
  );
}
