"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IconClose, IconSearch } from "@/components/icons";

export function OrderSearch({ initial, path = "/admin/orders", placeholder = "Order number, email or name" }: { initial: string; path?: string; placeholder?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  const submit = (value: string) => {
    const u = new URLSearchParams(params.toString());
    u.delete("page");
    if (value.trim()) {
      u.set("q", value.trim());
      u.set("tab", "all");
      u.delete("view");
    } else u.delete("q");
    router.push(`${path}?${u}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
      className="relative w-full lg:w-80"
      role="search"
    >
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[3px] border border-ink/15 bg-white pl-9 pr-9 text-sm focus:border-aubergine-500 focus:outline-none"
        aria-label={placeholder}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            submit("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-ink"
          aria-label="Clear search"
        >
          <IconClose className="size-4" />
        </button>
      )}
    </form>
  );
}
