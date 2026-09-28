"use client";

import Link from "next/link";
import { decideTrade } from "@/lib/actions/admin/people";
import { formatDate } from "./format";
import { useAction, useConfirm } from "./controls";
import { Badge, Button } from "./ui";

export type TradeApp = {
  id: string;
  user_id: string;
  company_name: string;
  vat_number: string | null;
  company_number: string | null;
  website: string | null;
  business_type: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
};

export function TradeCard({ app }: { app: TradeApp }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const decide = async (approve: boolean) => {
    const yes = await confirm({
      title: approve ? `Approve ${app.company_name}?` : `Decline ${app.company_name}?`,
      description: approve
        ? "They'll see trade prices as soon as they sign in, and we'll email them the good news."
        : "We'll email them to let them know. They can apply again later.",
      confirmLabel: approve ? "Approve" : "Decline",
      danger: !approve,
    });
    if (yes) run(() => decideTrade(app.id, approve));
  };
  const site = app.website ? (app.website.startsWith("http") ? app.website : `https://${app.website}`) : null;

  return (
    <article className="rounded-[3px] border border-ink/12 bg-cream-50">
      <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="font-display text-2xl leading-tight text-aubergine-900">{app.company_name}</h2>
          <p className="text-sm text-ink-soft">
            {app.profile?.full_name ?? "Unknown"} · applied {formatDate(app.created_at)}
          </p>
        </div>
        <Badge tone={app.status === "approved" ? "green" : app.status === "rejected" ? "red" : "gold"}>
          {app.status === "pending" ? "Waiting" : app.status === "approved" ? "Approved" : "Declined"}
        </Badge>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-5 py-4 text-sm">
        {app.profile?.email && (
          <>
            <dt className="text-stone-500">Email</dt>
            <dd className="break-all">
              <a href={`mailto:${app.profile.email}`} className="text-aubergine-700 underline-offset-2 hover:underline">
                {app.profile.email}
              </a>
            </dd>
          </>
        )}
        {app.profile?.phone && (
          <>
            <dt className="text-stone-500">Phone</dt>
            <dd>
              <a href={`tel:${app.profile.phone}`} className="text-aubergine-700">
                {app.profile.phone}
              </a>
            </dd>
          </>
        )}
        {app.business_type && (
          <>
            <dt className="text-stone-500">Business</dt>
            <dd>{app.business_type}</dd>
          </>
        )}
        {site && (
          <>
            <dt className="text-stone-500">Website</dt>
            <dd className="break-all">
              <a href={site} target="_blank" rel="noreferrer" className="text-aubergine-700 underline">
                {app.website}
              </a>
            </dd>
          </>
        )}
        {app.vat_number && (
          <>
            <dt className="text-stone-500">VAT number</dt>
            <dd className="font-mono">{app.vat_number}</dd>
          </>
        )}
        {app.company_number && (
          <>
            <dt className="text-stone-500">Company no.</dt>
            <dd className="font-mono">
              <a href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(app.company_number)}`} target="_blank" rel="noreferrer" className="text-aubergine-700 underline">
                {app.company_number}
              </a>
            </dd>
          </>
        )}
      </dl>
      {app.message && <p className="mx-5 mb-4 border-l-2 border-gold-500 pl-3 text-sm italic text-ink-soft">&ldquo;{app.message}&rdquo;</p>}
      <footer className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-5 py-4">
        {app.status !== "approved" && (
          <Button disabled={pending} onClick={() => decide(true)} className="flex-1 sm:flex-none">
            Approve
          </Button>
        )}
        {app.status !== "rejected" && (
          <Button variant="secondary" disabled={pending} onClick={() => decide(false)} className="flex-1 sm:flex-none">
            Decline
          </Button>
        )}
        <Link href={`/admin/customers/${app.user_id}`} className="ml-auto py-2 text-sm text-aubergine-700 underline-offset-2 hover:underline">
          View customer
        </Link>
      </footer>
    </article>
  );
}
