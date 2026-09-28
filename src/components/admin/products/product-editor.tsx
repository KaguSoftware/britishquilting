"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { IconBolt, IconChevronDown, IconExternal, IconScissors, IconSwatch, IconTrash } from "@/components/icons";
import { deleteProduct, saveProduct } from "@/lib/actions/admin/products";
import { cn, formatPence, slugify, storageUrl } from "@/lib/utils";
import { poundsToPence } from "../format";
import { SaveBar, Segmented, SwitchRow, useAction, useConfirm, useUnsavedGuard } from "../controls";
import { Button, Field, Input, MoneyInput, Textarea, UnitInput } from "../ui";
import { ColourPicker } from "@/components/ui/colour-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { ImageManager } from "./image-manager";
import type { ProductForm } from "./product-form";



const MODES = {
  metre: { label: "By the metre", unit: "per metre", explain: "Customers type the length they need and you cut it from the roll. Stock is counted in metres." },
  roll: { label: "By the roll", unit: "per roll", explain: "Customers buy whole rolls. Stock is counted in whole rolls, so each roll sold takes one off." },
  unit: { label: "Each", unit: "each", explain: "For things sold as single items, like packs, tapes or tools. Stock is counted in items." },
} as const;

export function ProductEditor({
  initial,
  isNew,
  categories,
  showCost = false,
}: {
  initial: ProductForm;
  isNew: boolean;
  categories: { id: string; name: string }[];
  /** Owner only: the private cost price field. */
  showCost?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [seoOpen, setSeoOpen] = useState(Boolean(initial.seo_title || initial.seo_description));
  const dirty = JSON.stringify(form) !== baseline || isNew;
  useUnsavedGuard(JSON.stringify(form) !== baseline);

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "name" && !f.slugTouched) next.slug = slugify(String(v));
      return next;
    });

  const mode = MODES[form.sale_mode];
  const stockUnit = form.sale_mode === "unit" ? "items" : form.sale_mode === "roll" ? "rolls" : "m";
  const costUnit = form.sale_mode === "metre" ? "metre" : form.sale_mode === "roll" ? "roll" : "unit";

  const save = async () => {
    const res = await run(
      () =>
        saveProduct({
          id: form.id,
          isNew,
          name: form.name,
          slug: form.slug,
          subtitle: form.subtitle,
          description: form.description,
          category_id: form.category_id || null,
          sale_mode: form.sale_mode,
          price_pence: poundsToPence(form.price) ?? -1,
          trade_price_pence: poundsToPence(form.trade_price),
          compare_at_pence: poundsToPence(form.compare_at),
          ...(showCost ? { cost_price_pence: poundsToPence(form.cost_price) } : {}),
          min_length_m: form.min_length_m,
          length_step_m: form.length_step_m,
          max_length_m: form.max_length_m,
          roll_length_m: form.roll_length_m,
          weight_g_per_unit: form.weight_g_per_unit || 0,
          swatch_enabled: form.swatch_enabled,
          swatch_price_pence: poundsToPence(form.swatch_price) ?? 0,
          stock_qty: form.stock_qty || 0,
          low_stock_threshold: form.low_stock_threshold || 0,
          track_stock: form.track_stock,
          colour: form.colour,
          colour_hex: form.colour_hex,
          composition: form.composition,
          width_cm: form.width_cm,
          weight_gsm: form.weight_gsm,
          care: form.care,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          is_active: form.is_active,
          is_featured: form.is_featured,
          seo_title: form.seo_title,
          seo_description: form.seo_description,
          images: form.images,
        }),
      { success: isNew ? "Product created." : "Saved." },
    );
    if (res.ok) {
      setBaseline(JSON.stringify(form));
      if (isNew) router.replace(`/admin/products/${form.id}`);
    }
  };

  const preview = useMemo(() => {
    const pence = poundsToPence(form.price);
    return { price: pence != null && pence >= 0 ? formatPence(pence) : "£0.00", img: storageUrl(form.images[0]?.storage_path) };
  }, [form.price, form.images]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Section title="The basics" hint="What shoppers see first.">
          <Field label="Product name" htmlFor="name">
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ivory Cotton Sateen Lining" className="text-lg" />
          </Field>
          <Field label="Short line under the name" htmlFor="subtitle" hint="One sentence, e.g. 'Soft, heavy sateen for lined curtains.'">
            <Input id="subtitle" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="desc" hint="Tell customers what it is, what it's for and why they'll love it. Leave a blank line between paragraphs.">
            <Textarea id="desc" value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-40" />
          </Field>
          <Field label="Web address" htmlFor="slug" hint="Made from the name automatically. Only change it if you need to.">
            <div className="flex items-center rounded-[3px] border border-stone-300 bg-white focus-within:border-aubergine-500">
              <span className="pl-3 text-sm text-stone-500">/product/</span>
              <input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) || e.target.value.toLowerCase(), slugTouched: true }))}
                className="h-11 flex-1 bg-transparent pr-3 text-[0.95rem] focus:outline-none"
              />
            </div>
          </Field>
        </Section>

        <Section title="Photos" hint="Drag to change the order. The first one is the main photo.">
          <ImageManager productId={form.id} images={form.images} onChange={(imgs) => set("images", imgs)} productName={form.name} />
        </Section>

        <Section title="How it's sold">
          <Segmented
            value={form.sale_mode}
            onChange={(v) => set("sale_mode", v)}
            className="w-full"
            options={[
              { value: "metre", label: "By the metre", icon: <IconScissors className="size-4" /> },
              { value: "roll", label: "By the roll", icon: <IconBolt className="size-4" /> },
              { value: "unit", label: "Each", icon: <IconSwatch className="size-4" /> },
            ]}
          />
          <p className="-mt-1 border-l-2 border-gold-500 pl-3 text-sm text-ink-soft">{mode.explain}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Price ${mode.unit}`} htmlFor="price" hint="Including VAT.">
              <MoneyInput id="price" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" className="text-lg" />
            </Field>
            <Field label={`Trade price ${mode.unit} (optional)`} htmlFor="trade" hint="What approved trade customers pay. Leave empty to use the normal price.">
              <MoneyInput id="trade" value={form.trade_price} onChange={(e) => set("trade_price", e.target.value)} placeholder="0.00" />
            </Field>
          </div>

          {form.sale_mode === "metre" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Smallest length" htmlFor="minl" hint="The least someone can order.">
                <UnitInput unit="m" id="minl" value={form.min_length_m} onChange={(e) => set("min_length_m", e.target.value)} />
              </Field>
              <Field label="Goes up in steps of" htmlFor="step" hint="e.g. 0.5 means 1m, 1.5m, 2m...">
                <UnitInput unit="m" id="step" value={form.length_step_m} onChange={(e) => set("length_step_m", e.target.value)} />
              </Field>
              <Field label="Longest length (optional)" htmlFor="maxl" hint="Leave empty for no limit.">
                <UnitInput unit="m" id="maxl" value={form.max_length_m} onChange={(e) => set("max_length_m", e.target.value)} />
              </Field>
            </div>
          )}
          {form.sale_mode === "roll" && (
            <Field label="Metres on each roll" htmlFor="roll" className="sm:max-w-xs">
              <UnitInput unit="m" id="roll" value={form.roll_length_m} onChange={(e) => set("roll_length_m", e.target.value)} />
            </Field>
          )}

          {showCost && (
            <Field label={`Cost price per ${costUnit} (optional)`} htmlFor="cost" hint={`What you paid per ${costUnit}, private. Only you see this, it works out your profit.`} className="sm:max-w-xs">
              <MoneyInput id="cost" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} placeholder="0.00" />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Was price (optional)" htmlFor="compare" hint="Shows the old price crossed out, for a sale.">
              <MoneyInput id="compare" value={form.compare_at} onChange={(e) => set("compare_at", e.target.value)} placeholder="0.00" />
            </Field>
            <Field label={`Weight ${mode.unit}`} htmlFor="wt" hint="Used to work out postage.">
              <UnitInput unit="grams" id="wt" value={form.weight_g_per_unit} onChange={(e) => set("weight_g_per_unit", e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
          </div>
        </Section>

        <Section title="Stock">
          <SwitchRow checked={form.track_stock} onChange={(v) => set("track_stock", v)} title="Keep count of stock" description="Turn off for things you can always get more of. When on, it can't be sold once it runs out." />
          {form.track_stock && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How much you have" htmlFor="stock" hint={form.sale_mode === "unit" ? "Number of items." : form.sale_mode === "roll" ? "Number of whole rolls." : "Total metres in stock."}>
                <UnitInput unit={stockUnit} id="stock" value={form.stock_qty} onChange={(e) => set("stock_qty", e.target.value.replace(/[^\d.]/g, ""))} className="text-lg" />
              </Field>
              <Field label="Warn me when it drops to" htmlFor="low" hint="It shows as 'Low stock' on your Today page.">
                <UnitInput unit={stockUnit} id="low" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
            </div>
          )}
        </Section>

        <Section title="Swatches" hint="A small sample customers can order before buying.">
          <SwitchRow checked={form.swatch_enabled} onChange={(v) => set("swatch_enabled", v)} title="Offer a swatch" />
          {form.swatch_enabled && (
            <Field label="Swatch price" htmlFor="sw" hint="Put 0 for free swatches." className="sm:max-w-xs">
              <MoneyInput id="sw" value={form.swatch_price} onChange={(e) => set("swatch_price", e.target.value)} placeholder="0.00" />
            </Field>
          )}
        </Section>

        <Section title="Fabric details">
          <Field label="Colour name" htmlFor="colour">
            <Input id="colour" value={form.colour} onChange={(e) => set("colour", e.target.value)} placeholder="e.g. Ivory" className="sm:max-w-sm" />
          </Field>
          <Field label="Colour shade" htmlFor="hex" hint="Pick the nearest tone, or paste an exact code.">
            <ColourPicker
              id="hex"
              value={form.colour_hex}
              onChange={(hex) => set("colour_hex", hex)}
              onPickName={(name) => !form.colour.trim() && set("colour", name)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Made from" htmlFor="comp">
              <Input id="comp" value={form.composition} onChange={(e) => set("composition", e.target.value)} placeholder="e.g. 100% cotton" />
            </Field>
            <Field label="Width" htmlFor="width">
              <UnitInput unit="cm" id="width" value={form.width_cm} onChange={(e) => set("width_cm", e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
            <Field label="Weight of fabric" htmlFor="gsm" hint="Grams per square metre.">
              <UnitInput unit="gsm" id="gsm" value={form.weight_gsm} onChange={(e) => set("weight_gsm", e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
          </div>
          <Field label="Care instructions" htmlFor="care">
            <Textarea id="care" value={form.care} onChange={(e) => set("care", e.target.value)} placeholder="e.g. Dry clean only" className="min-h-20" />
          </Field>
        </Section>

        <Section title="Where it appears">
          <Field label="Category" htmlFor="cat">
            <Dropdown
              id="cat"
              value={form.category_id}
              onChange={(v) => set("category_id", v)}
              sheetTitle="Category"
              options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <SwitchRow checked={form.is_active} onChange={(v) => set("is_active", v)} title="Show on the shop" description="When off, only staff can see it. Handy while you're still adding photos." />
          <SwitchRow checked={form.is_featured} onChange={(v) => set("is_featured", v)} title="Feature on the home page" />
          <Field label="Search words (optional)" htmlFor="tags" hint="Separate with commas, e.g. blackout, thermal, wide.">
            <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
        </Section>

        <section className="rounded-[3px] border border-ink/12 bg-cream-50">
          <button type="button" onClick={() => setSeoOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left">
            <span>
              <span className="block font-display text-[1.35rem] text-aubergine-900">Google listing</span>
              <span className="text-sm text-ink-soft">Optional. We fill this in from the name and description if you leave it.</span>
            </span>
            <IconChevronDown className={cn("size-5 text-stone-500 transition-transform", seoOpen && "rotate-180")} />
          </button>
          {seoOpen && (
            <div className="space-y-4 border-t border-ink/10 p-5">
              <Field label="Title in Google" htmlFor="seot" hint={`${form.seo_title.length} of about 60 letters`}>
                <Input id="seot" value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} placeholder={form.name} />
              </Field>
              <Field label="Description in Google" htmlFor="seod" hint={`${form.seo_description.length} of about 155 letters`}>
                <Textarea id="seod" value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} placeholder={form.subtitle} className="min-h-20" />
              </Field>
            </div>
          )}
        </section>

        {!isNew && (
          <div className="flex flex-col gap-3 border-t border-ink/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-soft">No longer selling it? Turning off &ldquo;Show on the shop&rdquo; keeps its history. Deleting removes it for good.</p>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${form.name}?`,
                    description: "This removes the product and its photos for good. Past orders keep their details. You can't undo this.",
                    confirmLabel: "Delete product",
                    danger: true,
                  })
                ) {
                  const r = await run(() => deleteProduct(form.id));
                  if (r.ok) {
                    setBaseline(JSON.stringify(form));
                    router.push("/admin/products");
                  }
                }
              }}
            >
              <IconTrash className="size-4" /> Delete product
            </Button>
          </div>
        )}

        <SaveBar
          dirty={dirty}
          saving={pending}
          onSave={save}
          saveLabel={isNew ? "Create product" : "Save changes"}
          onDiscard={isNew ? undefined : () => setForm(JSON.parse(baseline))}
        />
      </div>

      {/* Live preview */}
      <aside className="hidden xl:block">
        <div className="sticky top-8">
          <p className="mb-2 font-display text-lg italic text-stone-500">How it looks in the shop</p>
          <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
            <div className="relative aspect-[4/5] bg-cream-200" style={!preview.img && form.colour_hex ? { background: form.colour_hex } : undefined}>
              {preview.img ? (
                <img src={preview.img} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                !form.colour_hex && <span className="absolute inset-0 grid place-items-center text-sm text-stone-500">No photo yet</span>
              )}
              {!form.is_active && <span className="absolute left-3 top-3 rounded-[2px] bg-ink/80 px-2 py-0.5 text-xs text-cream-50">Hidden</span>}
            </div>
            <div className="p-4">
              <p className="font-display text-xl leading-tight text-aubergine-900">{form.name || "Product name"}</p>
              {form.subtitle && <p className="mt-1 text-sm text-ink-soft">{form.subtitle}</p>}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-lg tabular-nums">{preview.price}</span>
                <span className="text-sm text-stone-500">{mode.unit}</span>
                {form.compare_at && <span className="text-sm text-stone-500 line-through">{formatPence(poundsToPence(form.compare_at) ?? 0)}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                {form.colour && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full border border-ink/20" style={{ background: form.colour_hex || "transparent" }} />
                    {form.colour}
                  </span>
                )}
                {form.width_cm && <span>{form.width_cm}cm wide</span>}
                {form.swatch_enabled && <span>Swatch {poundsToPence(form.swatch_price) ? formatPence(poundsToPence(form.swatch_price)!) : "free"}</span>}
              </div>
              {form.track_stock && Number(form.stock_qty) <= 0 && <p className="mt-2 text-xs text-danger">Out of stock</p>}
            </div>
          </div>
          {!isNew && (
            <a href={`/product/${form.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-aubergine-700 hover:underline">
              Open the real page <IconExternal className="size-3.5" />
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[3px] border border-ink/12 bg-cream-50">
      <div className="border-b border-ink/10 px-5 py-4">
        <h2 className="font-display text-[1.35rem] text-aubergine-900">{title}</h2>
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}
