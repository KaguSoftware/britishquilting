"use client";

import { toast } from "sonner";
import { IconArrowLeft, IconArrowRight, IconPlus, IconTrash } from "@/components/icons";
import { ColourPicker } from "@/components/ui/colour-picker";
import { cn } from "@/lib/utils";
import { Switch } from "../controls";
import { Button, Field, Input, UnitInput } from "../ui";
import { ImageManager } from "./image-manager";
import { newVariant, type EditorVariant } from "./product-form";

/**
 * The colours one product is sold in. Each colour has its own name, shade, stock and photos;
 * shoppers pick one on the product page and the photos switch to match.
 */
export function VariantEditor({
  productId,
  productName,
  variants,
  onChange,
  trackStock,
  stockUnit,
  lowThreshold,
  seed,
}: {
  productId: string;
  productName: string;
  variants: EditorVariant[];
  onChange: (next: EditorVariant[]) => void;
  trackStock: boolean;
  stockUnit: string;
  lowThreshold: number;
  /** the product's single colour and stock, used to fill in the first colour */
  seed: { name: string; hex: string; stock: string };
}) {
  const patch = (id: string, p: Partial<EditorVariant>) => onChange(variants.map((v) => (v.id === id ? { ...v, ...p } : v)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= variants.length) return;
    const next = [...variants];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  const add = () => {
    if (variants.length === 0 && (seed.name.trim() || seed.hex)) {
      // Turning a single-colour product into a colour range: its colour becomes the first one.
      onChange([{ ...newVariant(seed.name.trim()), colour_hex: seed.hex, stock_qty: seed.stock || "0" }, newVariant()]);
    } else {
      onChange([...variants, newVariant()]);
    }
  };
  const remove = (v: EditorVariant) => {
    const before = variants;
    onChange(variants.filter((x) => x.id !== v.id));
    toast(`${v.name || "Colour"} removed`, {
      description: v.images.length ? "Its photos will be deleted when you save." : "It will be removed when you save.",
      action: { label: "Undo", onClick: () => onChange(before) },
    });
  };
  const total = variants.filter((v) => v.is_active).reduce((n, v) => n + (Number(v.stock_qty) || 0), 0);

  return (
    <div>
      {variants.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Sold in one colour. Add colours to sell this as one product with a colour choice, each with its own photos and stock.
        </p>
      ) : (
        <ol className="border-b border-ink/12">
          {variants.map((v, i) => {
            const qty = Number(v.stock_qty) || 0;
            return (
              <li key={v.id} className="border-t border-ink/12 py-5 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-3">
                  <span className="font-display w-8 text-xl tabular-nums text-stone-500">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className="size-6 shrink-0 rounded-full border border-ink/20"
                    style={{ background: v.colour_hex || "transparent" }}
                    aria-hidden
                  />
                  <p className={cn("font-display min-w-0 flex-1 truncate text-xl text-aubergine-900", !v.is_active && "text-stone-500 line-through")}>
                    {v.name || "New colour"}
                  </p>
                  {trackStock && v.is_active && (
                    <span className={cn("hidden text-xs sm:inline", qty <= 0 ? "text-danger" : qty <= lowThreshold ? "text-gold-600" : "text-stone-500")}>
                      {qty <= 0 ? "Sold out" : qty <= lowThreshold ? "Running low" : "In stock"}
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-[2px] p-1.5 text-ink-soft hover:bg-cream-200 disabled:opacity-30" aria-label={`Move ${v.name || "colour"} earlier`}>
                      <IconArrowLeft className="size-3.5 rotate-90" />
                    </button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === variants.length - 1} className="rounded-[2px] p-1.5 text-ink-soft hover:bg-cream-200 disabled:opacity-30" aria-label={`Move ${v.name || "colour"} later`}>
                      <IconArrowRight className="size-3.5 rotate-90" />
                    </button>
                    <button type="button" onClick={() => remove(v)} className="rounded-[2px] p-1.5 text-danger/80 hover:bg-danger/10" aria-label={`Remove ${v.name || "colour"}`}>
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-4 sm:pl-11">
                  <div className={cn("grid gap-4", trackStock ? "sm:grid-cols-[minmax(0,1fr)_10rem_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]")}>
                    <Field label="Colour name" htmlFor={`vn-${v.id}`}>
                      <Input id={`vn-${v.id}`} value={v.name} onChange={(e) => patch(v.id, { name: e.target.value })} placeholder="e.g. Ivory" />
                    </Field>
                    {trackStock && (
                      <Field label="How much you have" htmlFor={`vs-${v.id}`}>
                        <UnitInput unit={stockUnit} id={`vs-${v.id}`} value={v.stock_qty} onChange={(e) => patch(v.id, { stock_qty: e.target.value.replace(/[^\d.]/g, "") })} />
                      </Field>
                    )}
                    <div className="flex items-end pb-2.5">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
                        <Switch size="sm" checked={v.is_active} onChange={(on) => patch(v.id, { is_active: on })} label={`Offer ${v.name || "this colour"}`} />
                        {v.is_active ? "Offered" : "Hidden"}
                      </label>
                    </div>
                  </div>
                  <Field label="Colour shade" htmlFor={`vh-${v.id}`} hint="Shown as the swatch shoppers click.">
                    <ColourPicker
                      id={`vh-${v.id}`}
                      value={v.colour_hex}
                      onChange={(hex) => patch(v.id, { colour_hex: hex })}
                      onPickName={(name) => !v.name.trim() && patch(v.id, { name })}
                    />
                  </Field>
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink">Photos of {v.name || "this colour"}</p>
                    <ImageManager
                      productId={productId}
                      folder={`products/${productId}/${v.id}`}
                      images={v.images}
                      onChange={(imgs) => patch(v.id, { images: imgs })}
                      productName={[productName, v.name].filter(Boolean).join(", ")}
                      hint="Shown when a shopper picks this colour. The first one leads."
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={add}>
          <IconPlus className="size-4" /> Add a colour
        </Button>
        {trackStock && variants.length > 0 && (
          <p className="text-sm text-ink-soft">
            Total in stock <span className="tabular-nums text-ink">{Math.round(total * 100) / 100}</span> {stockUnit}
          </p>
        )}
      </div>
    </div>
  );
}
