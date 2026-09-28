"use client";

import Link from "next/link";
import { IconStar } from "@/components/icons";
import { deleteReview, setReviewStatus } from "@/lib/actions/admin/marketing";
import { cn } from "@/lib/utils";
import { timeAgo } from "./format";
import { useAction, useConfirm } from "./controls";
import { Badge, Button } from "./ui";

export type ReviewRow = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  product: { id: string; name: string } | null;
};

export function ReviewCard({ review: r }: { review: ReviewRow }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const set = (status: ReviewRow["status"]) => run(() => setReviewStatus(r.id, status), { undo: () => setReviewStatus(r.id, r.status) });

  return (
    <article className="flex flex-col rounded-[3px] border border-ink/12 bg-cream-50">
      <div className="flex-1 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex gap-0.5 text-gold-500" aria-label={`${r.rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <IconStar key={n} className={cn("size-4", n <= r.rating ? "fill-current" : "opacity-25")} />
            ))}
          </span>
          <span className="text-xs text-stone-500">{timeAgo(r.created_at)}</span>
        </div>
        {r.title && <h2 className="mt-2 font-display text-xl text-aubergine-900">{r.title}</h2>}
        {r.body && <p className="mt-1 whitespace-pre-line text-[0.95rem] leading-relaxed">{r.body}</p>}
        <p className="mt-3 text-sm text-ink-soft">
          {r.author_name}
          {r.verified_purchase && <Badge tone="green" className="ml-2">Bought it</Badge>}
        </p>
        {r.product && (
          <Link href={`/admin/products/${r.product.id}`} className="text-sm text-aubergine-700 underline-offset-2 hover:underline">
            {r.product.name}
          </Link>
        )}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-ink/10 px-5 py-3">
        {r.status !== "approved" && (
          <Button disabled={pending} onClick={() => set("approved")} className="flex-1 sm:flex-none">
            Approve
          </Button>
        )}
        {r.status !== "rejected" && (
          <Button variant="secondary" disabled={pending} onClick={() => set("rejected")} className="flex-1 sm:flex-none">
            Hide
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          className="ml-auto text-danger"
          onClick={async () => {
            if (await confirm({ title: "Delete this review?", description: "It will be removed for good.", confirmLabel: "Delete", danger: true })) run(() => deleteReview(r.id));
          }}
        >
          Delete
        </Button>
      </footer>
    </article>
  );
}
