"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { IconClose, IconSpinner } from "@/components/icons";
import { removeFromWishlist } from "@/lib/actions/account";

export function WishlistRemove({ productId, name }: { productId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove ${name} from wishlist`}
      onClick={() =>
        start(async () => {
          const r = await removeFromWishlist(productId);
          if (r?.ok) toast.success(r.message);
          else toast.error(r?.message ?? "Something went wrong.");
        })
      }
      className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center bg-cream-50/95 text-ink-soft shadow-soft transition-colors hover:text-danger disabled:opacity-60"
    >
      {pending ? <IconSpinner className="size-4 animate-spin" /> : <IconClose className="size-4" />}
    </button>
  );
}
