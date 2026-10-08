"use client";

import Link from "next/link";
import { useState } from "react";
import { IconBolt, IconCheck, IconPencil } from "@/components/icons";
import { setProductActive, updateStock, updateVariantStock } from "@/lib/actions/admin/products";
import { cn, formatPence, storageUrl } from "@/lib/utils";
import { SALE_MODE_LABEL } from "../format";
import { Switch, useAction } from "../controls";
import type { ActionResult } from "@/lib/actions/admin/types";

export type ProductRow = {
  id: string;
  name: string;
  colour: string | null;
  colour_hex: string | null;
  sale_mode: "metre" | "roll" | "unit";
  price_pence: number;
  stock_qty: number;
  low_stock_threshold: number;
  track_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  category: string | null;
  category_id: string | null;
  image: string | null;
  /** active and hidden colours, in shop order; empty for single-colour products */
  variants: { id: string; name: string; colour_hex: string | null; stock_qty: number; is_active: boolean }[];
};

export function ProductTable({ rows }: { rows: ProductRow[] }) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
      <table className="w-full text-sm">
        <thead className="hidden border-b border-ink/15 text-left text-xs text-stone-500 md:table-header-group">
          <tr>
            <th className="px-5 py-3 font-medium">Product</th>
            <th className="px-3 py-3 font-medium">Price</th>
            <th className="px-3 py-3 font-medium">In stock</th>
            <th className="px-5 py-3 text-right font-medium">On the shop</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {rows.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ p }: { p: ProductRow }) {
  const { run, pending } = useAction();
  const [active, setActive] = useState(p.is_active);
  const img = storageUrl(p.image);
  const unit = p.sale_mode === "unit" ? "" : p.sale_mode === "roll" ? "rolls" : "m";

  return (
    <tr className="grid grid-cols-[56px_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:table-row md:p-0">
      <td className="row-span-2 md:table-cell md:py-3 md:pl-5">
        <div className="flex items-center gap-4">
          <Link href={`/admin/products/${p.id}`} className="relative block size-14 shrink-0 overflow-hidden rounded-[2px] border border-ink/10 bg-cream-200">
            {img ? (
              <img src={img} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center" style={p.colour_hex ? { background: p.colour_hex } : undefined}>
                {!p.colour_hex && <IconBolt className="size-6 text-stone-500" />}
              </span>
            )}
          </Link>
          <div className="hidden min-w-0 md:block">
            <Name p={p} />
          </div>
        </div>
      </td>
      <td className="min-w-0 md:hidden">
        <Name p={p} />
      </td>
      <td className="md:hidden" />
      <td className="tabular-nums md:table-cell md:px-3 md:py-3">
        {formatPence(p.price_pence)} <span className="text-stone-500">{SALE_MODE_LABEL[p.sale_mode]}</span>
      </td>
      <td className="md:table-cell md:px-3 md:py-3">
        {p.track_stock && p.variants.length ? (
          <ul className="space-y-1.5">
            {p.variants.map((v) => (
              <li key={v.id} className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full border border-ink/20" style={{ background: v.colour_hex ?? "transparent" }} />
                <span className={cn("w-24 truncate text-xs", v.is_active ? "text-ink-soft" : "text-stone-500 line-through")} title={v.name}>
                  {v.name}
                </span>
                <StockCell
                  label={`${p.name}, ${v.name}`}
                  qty={v.stock_qty}
                  threshold={p.low_stock_threshold}
                  unit={unit}
                  save={(n) => updateVariantStock(v.id, n)}
                />
              </li>
            ))}
          </ul>
        ) : p.track_stock ? (
          <StockCell label={p.name} qty={p.stock_qty} threshold={p.low_stock_threshold} unit={unit} save={(n) => updateStock(p.id, n)} />
        ) : (
          <span className="text-stone-500">Not tracked</span>
        )}
      </td>
      <td className="col-start-3 row-start-1 md:table-cell md:px-5 md:py-3 md:text-right">
        <Switch
          checked={active}
          disabled={pending}
          label={active ? "Showing on the shop" : "Hidden from the shop"}
          onChange={(v) => {
            setActive(v);
            run(() => setProductActive(p.id, v), { undo: () => setProductActive(p.id, !v) }).then((r) => !r.ok && setActive(!v));
          }}
        />
      </td>
    </tr>
  );
}

function Name({ p }: { p: ProductRow }) {
  return (
    <>
      <Link href={`/admin/products/${p.id}`} className="group inline-flex items-center gap-1.5 font-medium text-ink hover:text-aubergine-700">
        {p.name}
        <IconPencil className="size-3.5 opacity-0 transition group-hover:opacity-100" />
      </Link>
      <p className="truncate text-xs text-stone-500">
        {[
          p.variants.length ? `${p.variants.length} ${p.variants.length === 1 ? "colour" : "colours"}` : p.colour,
          p.category,
          p.is_featured ? "Featured" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No category"}
      </p>
    </>
  );
}

function StockCell({
  label,
  qty,
  threshold,
  unit,
  save: persist,
}: {
  label: string;
  qty: number;
  threshold: number;
  unit: string;
  save: (n: number) => Promise<ActionResult<unknown>>;
}) {
  const { run, pending } = useAction();
  const [value, setValue] = useState(String(qty));
  const [saved, setSaved] = useState(qty);
  // Follow server changes (undo, orders, other staff) after router.refresh().
  const [serverQty, setServerQty] = useState(qty);
  if (qty !== serverQty) {
    setServerQty(qty);
    setSaved(qty);
    setValue(String(qty));
  }
  const n = Number(value);
  const dirty = value !== "" && Number.isFinite(n) && n !== saved;
  const low = saved > 0 && saved <= threshold;

  const save = () => {
    if (!dirty) return;
    if (n < 0) return setValue(String(saved));
    const before = saved;
    setSaved(n);
    run(() => persist(n), { undo: () => persist(before) }).then((r) => {
      if (!r.ok) {
        setSaved(before);
        setValue(String(before));
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex items-center gap-2"
    >
      <div className="relative">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          onBlur={save}
          inputMode="decimal"
          aria-label={`Stock for ${label}`}
          className={cn(
            unit.length > 1 ? "pr-11" : "pr-6",
            "h-9 w-24 rounded-[3px] border bg-white pl-2.5 text-sm tabular-nums focus:border-aubergine-500 focus:outline-none",
            saved <= 0 ? "border-danger/40 text-danger" : low ? "border-gold-500" : "border-ink/15",
          )}
        />
        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500">{unit}</span>}
      </div>
      {dirty ? (
        <button type="submit" disabled={pending} className="grid size-8 place-items-center rounded-[3px] bg-aubergine-800 text-cream-50" aria-label="Save stock">
          <IconCheck className="size-4" />
        </button>
      ) : saved <= 0 ? (
        <span className="text-xs text-danger">Sold out</span>
      ) : low ? (
        <span className="text-xs text-gold-600">Running low</span>
      ) : null}
    </form>
  );
}
