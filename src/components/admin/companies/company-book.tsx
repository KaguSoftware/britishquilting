"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconDocument, IconPencil, IconPhone, IconTrash, IconUsers } from "@/components/icons";
import { deleteCompany } from "@/lib/actions/admin/companies";
import type { Company } from "@/lib/companies";
import { telHref } from "@/lib/invoices";
import { Menu } from "@/components/ui/menu";
import { Button, EmptyState, btn } from "../ui";
import { useAction, useConfirm } from "../controls";
import { ListFrame, ListHead, ListRow } from "../list-row";
import { CompanyModal } from "./company-modal";

export type CompanyRow = Company & { members: number; invoices: number };

/** The Companies list. `adding` opens the form straight away. */
export function CompanyBook({ companies, searching, adding }: { companies: CompanyRow[]; searching: boolean; adding: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { run } = useAction();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Company | null>(null);
  const [open, setOpen] = useState(adding);

  const [sawAdding, setSawAdding] = useState(adding);
  if (adding !== sawAdding) {
    setSawAdding(adding);
    if (adding) {
      setEditing(null);
      setOpen(true);
    }
  }
  useEffect(() => {
    if (adding) router.replace(pathname, { scroll: false });
  }, [adding, pathname, router]);

  const remove = async (c: Company) => {
    const yes = await confirm({
      title: `Remove ${c.name}?`,
      description: "People linked to it are unlinked. Invoices already written keep the company's details.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (yes) await run(() => deleteCompany(c.id));
  };

  return (
    <>
      {companies.length === 0 ? (
        <EmptyState
          icon={<IconUsers />}
          title={searching ? "No companies match that search" : "No companies yet"}
          description={searching ? undefined : "Add the businesses you invoice, then link their people to them."}
          action={!searching ? <Button onClick={() => setOpen(true)}>Add a company</Button> : undefined}
        />
      ) : (
        <ListFrame>
          <ListHead cols={["", "Company", "Telephone", "People", "Invoices"]} />
          {companies.map((c) => (
            <ListRow
              key={c.id}
              href={`/admin/customers/companies/${c.id}`}
              refLabel={<span className="text-sm text-stone-500">{c.postcode ?? ""}</span>}
              title={c.name}
              sub={[c.city, c.email].filter(Boolean).join(" · ")}
              aside={c.phone ?? <span className="text-xs italic text-stone-500">No number</span>}
              badge={
                <span className="text-sm text-ink-soft">
                  {c.members} {c.members === 1 ? "person" : "people"}
                </span>
              }
              figure={String(c.invoices)}
              action={
                c.phone ? (
                  <a href={telHref(c.phone)} className={btn("secondary", "sm")} title={`Call ${c.name}`}>
                    <IconPhone className="size-4" /> Call
                  </a>
                ) : null
              }
              menu={
                <Menu
                  label={`More for ${c.name}`}
                  title={c.name}
                  items={[
                    { label: "Open company", icon: <IconUsers />, href: `/admin/customers/companies/${c.id}` },
                    { label: "New invoice", icon: <IconDocument />, href: `/admin/invoices/new?company=${c.id}` },
                    {
                      label: "Edit details",
                      icon: <IconPencil />,
                      onSelect: () => {
                        setEditing(c);
                        setOpen(true);
                      },
                    },
                    { label: "Remove", icon: <IconTrash />, onSelect: () => remove(c), danger: true },
                  ]}
                />
              }
            />
          ))}
        </ListFrame>
      )}
      <CompanyModal open={open} company={editing} onClose={() => setOpen(false)} onSaved={(c) => !editing && router.push(`/admin/customers/companies/${c.id}`)} />
    </>
  );
}
