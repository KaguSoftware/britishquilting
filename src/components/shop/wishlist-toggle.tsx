"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { IconHeart, IconSpinner } from "@/components/icons";
import { toggleWishlist } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

/** Heart "Save" toggle for the product page. `saved` is null when signed out. */
export function WishlistToggle({ productId, saved: initial, next }: { productId: string; saved: boolean | null; next: string }) {
  const [saved, setSaved] = useState(Boolean(initial));
  const [pending, start] = useTransition();
  const cls = "inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft transition-colors hover:text-aubergine-700";

  if (initial === null)
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={cls}>
        <IconHeart className="size-4" /> Sign in to save
      </Link>
    );

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleWishlist(productId, !saved);
          if (r?.ok) {
            setSaved(Boolean(r.saved));
            toast.success(r.message);
          } else toast.error(r?.message ?? "Something went wrong.");
        })
      }
      className={cn(cls, saved && "text-aubergine-700", "disabled:opacity-60")}
    >
      {pending ? <IconSpinner className="size-4 animate-spin" /> : <IconHeart className="size-4" fill={saved ? "currentColor" : "none"} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
