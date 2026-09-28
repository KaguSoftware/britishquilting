"use client";

import { useState } from "react";
import { promoteToStaff, removeStaff, restoreStaff } from "@/lib/actions/admin/people";
import { useAction, useConfirm } from "./controls";
import { Badge, Button, Card, Field, Input } from "./ui";

type Person = { id: string; email: string | null; full_name: string | null; role: string };

export function StaffManager({ people, me }: { people: Person[]; me: string }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [email, setEmail] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <ul className="self-start overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
        {people.map((p) => (
          <li key={p.id} className="flex min-h-16 items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-0 md:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-aubergine-800 font-display text-lg text-cream-50">
              {(p.full_name || p.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {p.full_name || p.email}
                {p.id === me && <span className="text-stone-500"> (you)</span>}
              </p>
              <p className="truncate text-xs text-stone-500">{p.email}</p>
            </div>
            <Badge tone={p.role === "owner" ? "gold" : "aubergine"}>{p.role === "owner" ? "Owner" : "Staff"}</Badge>
            {p.role === "staff" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-danger"
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Remove ${p.full_name || p.email}?`,
                      description: "They'll keep their shop account but won't be able to open the back office any more.",
                      confirmLabel: "Remove access",
                      danger: true,
                    })
                  )
                    run(() => removeStaff(p.id), { undo: () => restoreStaff(p.id) });
                }}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Card title="Add someone" description="They need to have created an account on the shop first, using this email.">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => promoteToStaff(email));
            if (r.ok) setEmail("");
          }}
        >
          <Field label="Their email" htmlFor="semail">
            <Input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          <Button type="submit" disabled={pending || !email.includes("@")} className="w-full">
            Give back office access
          </Button>
        </form>
      </Card>
    </div>
  );
}
