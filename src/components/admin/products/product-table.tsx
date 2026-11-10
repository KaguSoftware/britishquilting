"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBell, IconBolt, IconCheck, IconPencil } from "@/components/icons";
import { setProductActive, setStockAlert, updateStock, updateVariantStock } from "@/lib/actions/admin/products";
import { cn, formatPence, storageUrl } from "@/lib/utils";
import { SALE_MODE_LABEL } from "../format";
import { Switch, useAction } from "../controls";
import { Checkbox } from "@/components/ui/choice";
import type { ActionResult } from "@/lib/actions/admin/types";

export type ProductRow = {
  id: string;
  name: string;
  /** e.g. LIN3; each colour adds its letters (LIN3RED) */
  code: string | null;
  colour: string | null;
  colour_hex: string | null;
  sale_mode: "metre" | "roll" | "unit";
  price_pence: number;
  stock_qty: number;
  /** staff alert level for a single-colour product; null when off */
  alert_below: number | null;
  low_stock_threshold: number;
  track_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  category: string | null;
  category_id: string | null;
  image: string | null;
  /** active and hidden colours, in shop order; empty for single-colour products */
  variants: { id: string; name: string; colour_hex: string | null; stock_qty: number; alert_below: number | null; is_active: boolean }[];
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
  const multi = p.track_stock && p.variants.length > 0;
  const count = p.variants.length;
  const out = p.variants.filter((v) => v.stock_qty <= 0).length;
  // A watched colour counts as low at its own alert level; the rest use the shop's default.
  const low = p.variants.filter((v) => v.stock_qty > 0 && v.stock_qty <= (v.alert_below ?? p.low_stock_threshold)).length;
  const fine = count - out - low;

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
        {multi ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex flex-wrap items-center gap-x-2.5 text-xs">
              {out > 0 && <span className="font-medium text-danger">{out} out of stock</span>}
              {low > 0 && <span className="font-medium text-alert">{low} low</span>}
              {fine > 0 && <span className="text-success">{fine} in stock</span>}
            </span>
            <StockPopover p={p} unit={unit} />
          </div>
        ) : p.track_stock ? (
          <div className="flex flex-wrap items-center gap-2">
            <StockCell label={p.name} qty={p.stock_qty} threshold={p.alert_below ?? p.low_stock_threshold} unit={unit} save={(n) => updateStock(p.id, n)} />
            <StockPopover p={p} unit={unit} />
          </div>
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
          p.code,
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
  compact,
}: {
  label: string;
  qty: number;
  threshold: number;
  unit: string;
  save: (n: number) => Promise<ActionResult<unknown>>;
  compact?: boolean;
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
            compact ? "h-8 w-20" : "h-9 w-24", "rounded-[3px] border bg-white pl-2.5 text-sm tabular-nums focus:border-aubergine-500 focus:outline-none",
            saved <= 0 ? "border-danger/40 text-danger" : low ? "border-gold-500" : "border-ink/15",
          )}
        />
        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500">{unit}</span>}
      </div>
      {dirty ? (
        <button type="submit" disabled={pending} className="grid size-8 place-items-center rounded-[3px] bg-aubergine-800 text-cream-50" aria-label="Save stock">
          <IconCheck className="size-4" />
        </button>
      ) : compact ? null : saved <= 0 ? (
        <span className="text-xs text-danger">Sold out</span>
      ) : low ? (
        <span className="text-xs text-gold-600">Running low</span>
      ) : null}
    </form>
  );
}

/** Small panel that opens right under its button; colours stack in one column. */
function StockPopover({ p, unit }: { p: ProductRow; unit: string }) {
  const { run, pending } = useAction();
  const multi = p.variants.length > 0;
  const watchedNow = multi ? p.variants.filter((v) => v.alert_below != null) : [];
  const levelNow = multi ? null : p.alert_below;
  const isOn = multi ? watchedNow.length > 0 : p.alert_below != null;
  const fromServer = () => new Map(watchedNow.map((v) => [v.id, String(v.alert_below)]));
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(isOn);
  const [level, setLevel] = useState(levelNow == null ? "" : String(levelNow));
  /** colour id -> alert level as typed; presence means the colour is watched */
  const [picked, setPicked] = useState<Map<string, string>>(fromServer);
  // Follow the server (undo, other staff) after router.refresh().
  const sig = `${isOn}|${levelNow}|${watchedNow.map((v) => `${v.id}:${v.alert_below}`).join(",")}`;
  const [seen, setSeen] = useState(sig);
  if (sig !== seen) {
    setSeen(sig);
    setOn(isOn);
    setLevel(levelNow == null ? "" : String(levelNow));
    setPicked(fromServer());
  }
  const okNum = (t: string | undefined) => t != null && t !== "" && Number.isFinite(Number(t)) && Number(t) >= 0;
  const n = Number(level);
  const valid = multi ? picked.size > 0 && [...picked.values()].every(okNum) : okNum(level);
  const dirty =
    on &&
    (!isOn ||
      (multi
        ? picked.size !== watchedNow.length || watchedNow.some((v) => picked.get(v.id) !== String(v.alert_below))
        : n !== levelNow));

  const saveAlert = (below: number | null, colours: { id: string; below: number }[]) => run(() => setStockAlert(p.id, below, colours));
  const toggle = (v: boolean) => {
    setOn(v);
    if (!v && isOn) saveAlert(null, []);
  };

  const [find, setFind] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const W = 340;

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
    setPos({ top: r.bottom + 6, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const list = p.variants.filter((v) => v.name.toLowerCase().includes(find.toLowerCase().trim()));

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("inline-flex h-8 items-center rounded-[3px] border bg-white px-3 text-xs hover:border-aubergine-500", isOn ? "border-alert/50 text-alert" : "border-ink/15 text-ink")}
      >
        {multi ? (open ? "Hide stock" : "Show stock") : <IconBell className="size-4" title="Stock alert" />}
        {!multi && <span className="sr-only">Stock alert</span>}
        {isOn && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-alert align-middle" />}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`Stock for ${p.name}`}
            style={{ top: pos.top, left: pos.left, width: W }}
            className="fixed z-50 rounded-[3px] border border-ink/15 bg-cream-50 p-3 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
          >
            <p className="mb-2 truncate text-sm font-medium text-ink">{p.name}</p>
            {multi && p.variants.length > 8 && (
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find a colour"
                aria-label={`Find a colour of ${p.name}`}
                className="mb-2 h-8 w-full rounded-[3px] border border-ink/15 bg-white px-2.5 text-sm"
              />
            )}
            {multi && <ul className="max-h-64 divide-y divide-ink/10 overflow-y-auto pr-1">
              {list.map((v) => (
                <li key={v.id} className="py-1.5">
                  <div className="flex items-center gap-2">
                    {on && (
                      <Checkbox
                        aria-label={`Alert me about ${v.name}`}
                        className="min-h-0 py-0"
                        label={null}
                        checked={picked.has(v.id)}
                        onChange={(e) => setPicked((s) => { const next = new Map(s); if (e.target.checked) next.set(v.id, s.get(v.id) ?? ""); else next.delete(v.id); return next; })}
                      />
                    )}
                    <span className="size-3 shrink-0 rounded-full border border-ink/20" style={{ background: v.colour_hex ?? "transparent" }} />
                    <span className={cn("min-w-0 flex-1 truncate text-xs", v.is_active ? "text-ink-soft" : "text-stone-500 line-through")} title={v.name}>
                      {v.name}
                    </span>
                    <StockCell label={`${p.name}, ${v.name}`} qty={v.stock_qty} threshold={v.alert_below ?? p.low_stock_threshold} unit={unit} save={(n) => updateVariantStock(v.id, n)} compact />
                  </div>
                  {on && picked.has(v.id) && (
                    <label className="mt-1.5 flex items-center justify-end gap-2 text-xs text-alert">
                      Alert at or below
                      <span className="relative">
                        <input
                          value={picked.get(v.id) ?? ""}
                          onChange={(e) => setPicked((s) => new Map(s).set(v.id, e.target.value.replace(/[^\d.]/g, "")))}
                          inputMode="decimal"
                          aria-label={`Alert level for ${v.name}`}
                          className={cn(unit.length > 1 ? "pr-11" : "pr-6", "h-8 w-20 rounded-[3px] border border-alert/40 bg-white pl-2.5 text-sm tabular-nums focus:border-alert focus:outline-none")}
                        />
                        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500">{unit}</span>}
                      </span>
                    </label>
                  )}
                </li>
              ))}
              {list.length === 0 && <li className="py-2 text-xs text-stone-500">No colour matches.</li>}
            </ul>}
            <div className={cn("space-y-2.5 text-sm", multi && "mt-3 border-t border-ink/15 pt-3")}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <IconBell className="size-4 text-alert" /> Stock alert
                </span>
                <Switch size="sm" checked={on} disabled={pending} onChange={toggle} label="Stock alert" />
              </div>
              {on && (
                <>
                  {!multi && <label className="flex items-center gap-2 text-xs text-ink-soft">
                    Alert me at or below
                    <span className="relative">
                      <input
                        value={level}
                        onChange={(e) => setLevel(e.target.value.replace(/[^\d.]/g, ""))}
                        inputMode="decimal"
                        aria-label="Alert level"
                        className={cn(unit.length > 1 ? "pr-11" : "pr-6", "h-8 w-24 rounded-[3px] border border-ink/15 bg-white pl-2.5 text-sm tabular-nums focus:border-alert focus:outline-none")}
                      />
                      {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500">{unit}</span>}
                    </span>
                  </label>}
                  {multi && <p className="text-xs text-stone-500">Tick each colour to watch and set its own level.</p>}
                  {dirty && (
                    <button
                      type="button"
                      disabled={!valid || pending}
                      onClick={() => (multi ? saveAlert(null, [...picked].map(([id, t]) => ({ id, below: Number(t) }))) : saveAlert(n, []))}
                      className="h-8 w-full rounded-[3px] bg-aubergine-800 text-xs text-cream-50 disabled:opacity-50"
                    >
                      Save alert
                    </button>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
