"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconDocument, IconPencil, IconPhone, IconPlus, IconTrash, IconUsers } from "@/components/icons";
import { deleteManualCustomer } from "@/lib/actions/admin/invoices";
import { telHref, type ManualCustomer } from "@/lib/invoices";
import { Button, ButtonLink, EmptyState, btn } from "../ui";
import { useAction, useConfirm } from "../controls";
import { CustomerModal } from "@/components/admin/customers/customer-modal";

/** Customers added by hand on the Customers page, with a call button on each. `adding` opens the form straight away. */
export function CustomerBook({ customers, searching, adding }: { customers: ManualCustomer[]; searching: boolean; adding: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { run } = useAction();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ManualCustomer | null>(null);
  const [open, setOpen] = useState(adding);

  // Opened from the "Add customer" button in the header: tidy the URL so a refresh doesn't reopen it.
  useEffect(() => {
    if (!adding) return;
    router.replace(`${pathname}?view=manual`, { scroll: false });
  }, [adding, pathname, router]);

  const edit = (c: ManualCustomer | null) => {
    setEditing(c);
    setOpen(true);
  };

  const remove = async (c: ManualCustomer) => {
    const yes = await confirm({
      title: `Remove ${c.full_name}?`,
      description: "Invoices already written for them keep their details.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (yes) await run(() => deleteManualCustomer(c.id));
  };

  return (
    <>
      {customers.length === 0 ? (
        <EmptyState
          icon={<IconUsers />}
          title={searching ? "No customers match that search" : "No customers yet"}
          description={
            searching
              ? "Try part of their name, company, email or phone number."
              : "Add people who buy without a website account, like phone orders, trade accounts and show customers."
          }
          action={
            searching ? undefined : (
              <Button onClick={() => edit(null)}>
                <IconPlus className="size-4" /> Add customer
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-ink/15 text-left text-xs text-stone-500 md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Telephone</th>
                <th className="px-3 py-3 font-medium">Address</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {customers.map((c) => (
                <tr key={c.id} className="block px-4 py-3 md:table-row md:p-0">
                  <td className="block md:table-cell md:px-5 md:py-3.5">
                    <span className="font-medium">{c.full_name}</span>
                    {c.company && <span className="block text-xs text-stone-500">{c.company}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="block text-xs text-stone-500 hover:text-aubergine-700">
                        {c.email}
                      </a>
                    )}
                  </td>
                  <td className="mt-1 block md:mt-0 md:table-cell md:px-3 md:py-3.5">
                    {c.phone ? <span className="tabular-nums text-ink-soft">{c.phone}</span> : <span className="text-xs italic text-stone-500">No number on file</span>}
                  </td>
                  <td className="mt-1 block text-ink-soft md:mt-0 md:table-cell md:max-w-xs md:px-3 md:py-3.5">
                    <span className="line-clamp-2">{[c.line1, c.city, c.postcode].filter(Boolean).join(", ")}</span>
                  </td>
                  <td className="mt-3 block md:mt-0 md:table-cell md:px-5 md:py-3.5">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {c.phone && (
                        <a href={telHref(c.phone)} className={btn("secondary", "sm")} title={`Call ${c.full_name}`}>
                          <IconPhone className="size-4" /> Call
                        </a>
                      )}
                      <ButtonLink href={`/admin/invoices/new?customer=${c.id}`} size="sm">
                        <IconDocument className="size-4" /> New invoice
                      </ButtonLink>
                      <Button variant="ghost" size="sm" onClick={() => edit(c)} aria-label={`Edit ${c.full_name}`}>
                        <IconPencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(c)} aria-label={`Remove ${c.full_name}`}>
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerModal open={open} customer={editing} onClose={() => setOpen(false)} />
    </>
  );
}
