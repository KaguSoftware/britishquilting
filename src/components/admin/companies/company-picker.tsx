"use client";

import { useState } from "react";
import { saveCompany, searchCompanies } from "@/lib/actions/admin/companies";
import type { Company } from "@/lib/companies";
import { cn } from "@/lib/utils";
import { SearchSelect } from "../search-select";

/**
 * Pick the company someone belongs to, or create one from what was typed. `value` is the company's name
 * as shown; `onChange(null)` unlinks.
 */
export function CompanyPicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: { id: string; name: string } | null;
  onChange: (c: { id: string; name: string } | null) => void;
  className?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const search = async (q: string) => {
    setLastQuery(q);
    return searchCompanies(q);
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SearchSelect<Company>
        id={id}
        search={search}
        onPick={(c) => onChange({ id: c.id, name: c.name })}
        itemKey={(c) => c.id}
        display={value?.name}
        placeholder="Search companies"
        label="Company"
        className="min-w-0 flex-1"
        renderItem={(c) => (
          <>
            <span className={cn("block truncate text-[0.95rem] text-ink", c.id === value?.id && "font-medium text-aubergine-800")}>{c.name}</span>
            <span className="block truncate text-sm text-ink-soft">{[c.city, c.postcode, c.phone].filter(Boolean).join(" · ") || "No address yet"}</span>
          </>
        )}
        empty={(q) => (q ? `No company matches “${q}”.` : "No companies yet.")}
        footer={(close) =>
          lastQuery.trim().length >= 2 ? (
            <button
              type="button"
              disabled={creating}
              onClick={async () => {
                setCreating(true);
                const res = await saveCompany({ name: lastQuery.trim() });
                setCreating(false);
                close();
                if (res.ok && res.data) onChange({ id: res.data.id, name: res.data.name });
              }}
              className="text-sm text-aubergine-700 underline-offset-2 hover:underline"
            >
              {creating ? "Adding..." : `+ Add “${lastQuery.trim()}” as a new company`}
            </button>
          ) : null
        }
      />
      {value && (
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-sm text-ink-soft underline-offset-2 hover:text-danger hover:underline">
          Unlink
        </button>
      )}
    </div>
  );
}
