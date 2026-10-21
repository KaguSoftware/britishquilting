"use client";

import { searchProducts } from "@/lib/actions/admin/invoices";
import type { ProductPick } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";

/** How products are found and listed wherever a pad offers them: by code or by name. */
export const productSuggest = {
  search: searchProducts,
  itemKey: (p: ProductPick) => p.key,
  renderItem: (p: ProductPick) => (
    <span className="grid grid-cols-[84px_1fr_auto] items-baseline gap-3">
      <span className="text-sm font-medium tabular-nums text-aubergine-800">{p.code}</span>
      <span className="min-w-0">
        <span className="block truncate text-[0.95rem] text-ink">{p.description}</span>
        {p.hidden && <span className="block text-xs text-stone-500">Hidden from the shop</span>}
      </span>
      <span className="text-sm tabular-nums text-ink-soft">
        {formatPence(p.unit_price_pence)} <span className="text-xs">{p.per}</span>
      </span>
    </span>
  ),
};
