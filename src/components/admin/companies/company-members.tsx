"use client";

import Link from "next/link";
import { linkCustomerToCompany, searchLinkableCustomers } from "@/lib/actions/admin/companies";
import type { CompanyMember } from "@/lib/companies";
import { customerNo } from "@/lib/invoices";
import { useAction } from "../controls";
import { SearchSelect } from "../search-select";

const KIND = { manual: "Added by hand", account: "Website account" } as const;
const href = (m: CompanyMember) => (m.kind === "manual" ? `/admin/customers/manual/${m.id}` : `/admin/customers/${m.id}`);

/** The people linked to a company, with a search to link someone else and an Unlink on each. */
export function CompanyMembers({ companyId, members }: { companyId: string; members: CompanyMember[] }) {
  const { run } = useAction();
  return (
    <div>
      {members.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-ink-soft">No one is linked to this company yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {members.map((m) => (
            <li key={`${m.kind}-${m.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <span className="w-20 shrink-0 font-display tabular-nums text-aubergine-900">{m.cid ? customerNo(m.cid) : ""}</span>
              <Link href={href(m)} className="min-w-0 flex-1 truncate font-medium text-ink hover:text-aubergine-700 hover:underline">
                {m.name}
              </Link>
              <span className="text-xs text-stone-500">{KIND[m.kind]}</span>
              <button
                type="button"
                onClick={() => run(() => linkCustomerToCompany({ kind: m.kind, id: m.id, companyId: null }))}
                className="text-sm text-ink-soft underline-offset-2 hover:text-danger hover:underline"
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-ink/10 px-5 py-4">
        <SearchSelect<CompanyMember>
          search={searchLinkableCustomers}
          onPick={(m) => run(() => linkCustomerToCompany({ kind: m.kind, id: m.id, companyId }))}
          itemKey={(m) => `${m.kind}-${m.id}`}
          placeholder="Link someone: search name, email, phone or CID"
          label="Link a customer to this company"
          renderItem={(m) => (
            <>
              <span className="block truncate text-[0.95rem] text-ink">{m.name}</span>
              <span className="block truncate text-sm text-ink-soft">{[m.cid ? customerNo(m.cid) : null, KIND[m.kind], m.email].filter(Boolean).join(" · ")}</span>
            </>
          )}
          empty={(q) => (q ? `No customer matches “${q}”.` : "Type to search customers.")}
        />
      </div>
    </div>
  );
}
