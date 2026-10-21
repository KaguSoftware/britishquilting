"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconDeliveryNote, IconDocument, IconPencil, IconPhone, IconPlus, IconTrash, IconUsers } from "@/components/icons";
import { deleteManualCustomer } from "@/lib/actions/admin/invoices";
import { customerNo, telHref, type ManualCustomer } from "@/lib/invoices";
import { Menu } from "@/components/ui/menu";
import { Button, EmptyState, btn } from "../ui";
import { useAction, useConfirm } from "../controls";
import { ListFrame, ListHead, ListRow } from "../list-row";
import { CustomerModal } from "@/components/admin/customers/customer-modal";

/** Customers added by hand on the Customers page. `adding` opens the form straight away. */
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
      description: "Invoices and delivery notes already written for them keep their details.",
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
              ? "Try part of their name, company, email, phone number or CID."
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
        <ListFrame>
          <ListHead cols={["CID", "Customer", "Telephone", "Address", ""]} />
          {customers.map((c) => (
            <ListRow
              key={c.id}
              href={`/admin/customers/manual/${c.id}`}
              refLabel={customerNo(c.number)}
              title={c.full_name}
              sub={[c.company, c.email].filter(Boolean).join(" · ")}
              aside={c.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
              badge={<span className="text-sm text-ink-soft">{[c.line1, c.city, c.postcode].filter(Boolean).join(", ")}</span>}
              action={
                c.phone ? (
                  <a href={telHref(c.phone)} className={btn("secondary", "sm")} title={`Call ${c.full_name}`}>
                    <IconPhone className="size-4" /> Call
                  </a>
                ) : null
              }
              menu={
                <Menu
                  label={`More for ${c.full_name}`}
                  title={c.full_name}
                  items={[
                    { label: "Invoices and delivery notes", icon: <IconDocument />, href: `/admin/customers/manual/${c.id}` },
                    { label: "New invoice", icon: <IconDocument />, href: `/admin/invoices/new?customer=${c.id}` },
                    { label: "New delivery note", icon: <IconDeliveryNote />, href: `/admin/delivery-notes/new?customer=${c.id}` },
                    { label: "Edit details", icon: <IconPencil />, onSelect: () => edit(c) },
                    { label: "Remove", icon: <IconTrash />, onSelect: () => remove(c), danger: true },
                  ]}
                />
              }
            />
          ))}
        </ListFrame>
      )}

      <CustomerModal open={open} customer={editing} onClose={() => setOpen(false)} />
    </>
  );
}
