"use client";

import { useState } from "react";
import Link from "next/link";
import { linkCustomerToCompany } from "@/lib/actions/admin/companies";
import { useAction } from "../controls";
import { CompanyPicker } from "./company-picker";

/** The company a customer belongs to, changed in place on their page. */
export function LinkCompany({ kind, id, company }: { kind: "manual" | "account"; id: string; company: { id: string; name: string } | null }) {
  const { run } = useAction();
  const [value, setValue] = useState(company);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Company</p>
        {value && (
          <Link href={`/admin/customers/companies/${value.id}`} className="text-sm text-aubergine-700 underline-offset-2 hover:underline">
            Open company
          </Link>
        )}
      </div>
      <CompanyPicker
        className="mt-1.5"
        value={value}
        onChange={async (c) => {
          const before = value;
          setValue(c);
          const res = await run(() => linkCustomerToCompany({ kind, id, companyId: c?.id ?? null }));
          if (!res.ok) setValue(before);
        }}
      />
    </div>
  );
}
