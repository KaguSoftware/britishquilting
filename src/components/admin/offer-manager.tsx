"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { IconOffer, IconPencil, IconPlus } from "@/components/icons";
import { Dropdown } from "@/components/ui/dropdown";
import { endOffer, saveOffer } from "@/lib/actions/admin/offers";
import { cn, formatPence, storageUrl } from "@/lib/utils";
import { SALE_MODE_LABEL, poundsToPence } from "./format";
import { Modal, Segmented, useAction, useConfirm } from "./controls";
import { Badge, Button, EmptyState, Field, MoneyInput, UnitInput } from "./ui";

export type OfferProduct = {
  id: string;
  name: string;
  colour: string | null;
  sale_mode: "metre" | "roll" | "unit";
  price_pence: number;
  compare_at_pence: number | null;
  is_active: boolean;
  image: string | null;
};

const onOffer = (p: OfferProduct) => p.compare_at_pence != null && p.compare_at_pence > p.price_pence;
/** The price the product goes back to when the offer ends. */
const normalPrice = (p: OfferProduct) => (onOffer(p) ? p.compare_at_pence! : p.price_pence);
const percentOff = (was: number, now: number) => Math.round(((was - now) / was) * 100);

export function OfferManager({ products }: { products: OfferProduct[] }) {
  const { run } = useAction();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<OfferProduct | "new" | null>(null);
  const offers = products.filter(onOffer);
  const available = products.filter((p) => !onOffer(p) && p.price_pence > 0);

  const end = async (p: OfferProduct) => {
    const yes = await confirm({
      title: `End the offer on ${p.name}?`,
      description: `It goes back to ${formatPence(normalPrice(p))} and leaves Special Offers on the shop.`,
      confirmLabel: "End offer",
    });
    if (!yes) return;
    const r = await run(() => endOffer(p.id), { success: "" });
    if (r.ok && r.data) {
      const price = r.data.pricePence;
      toast.success(r.message ?? "Offer ended", {
        duration: 8000,
        action: { label: "Undo", onClick: () => run(() => saveOffer({ productId: p.id, pricePence: price }), { success: "Offer put back" }) },
      });
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")} disabled={!available.length}>
          <IconPlus className="size-4" /> Create an offer
        </Button>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={<IconOffer />}
          title="Nothing on offer"
          description="Choose a product and a lower price for an end of roll, seconds or clearance sale."
          action={available.length ? <Button onClick={() => setEditing("new")}>Create an offer</Button> : undefined}
        />
      ) : (
        <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {offers.map((p) => {
            const img = storageUrl(p.image, "products");
            return (
              <li key={p.id} className="flex flex-col gap-3 border-b border-ink/10 px-4 py-4 last:border-0 sm:flex-row sm:items-center md:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-[2px] bg-cream-200">
                    {img && <img src={img} alt="" className="absolute inset-0 size-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/products/${p.id}`} className="truncate font-medium text-ink hover:text-aubergine-700">
                        {p.name}
                      </Link>
                      {!p.is_active && <Badge>Hidden from the shop</Badge>}
                    </div>
                    <p className="mt-0.5 tabular-nums">
                      <span className="font-display text-xl text-aubergine-900">{formatPence(p.price_pence)}</span>{" "}
                      <span className="text-sm text-stone-500 line-through">{formatPence(p.compare_at_pence!)}</span>{" "}
                      <span className="text-sm text-stone-500">{SALE_MODE_LABEL[p.sale_mode]}</span>
                    </p>
                    <p className="text-xs text-stone-500">{percentOff(p.compare_at_pence!, p.price_pence)}% off</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(p)} className="grid size-11 place-items-center rounded-[3px] text-ink-soft hover:bg-cream-200" aria-label={`Change the offer on ${p.name}`}>
                    <IconPencil className="size-4" />
                  </button>
                  <Button variant="secondary" size="sm" onClick={() => end(p)}>
                    End offer
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New special offer" : "Change the offer"}>
        {editing && <OfferForm product={editing === "new" ? null : editing} choices={available} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function OfferForm({ product, choices, onDone }: { product: OfferProduct | null; choices: OfferProduct[]; onDone: () => void }) {
  const { run, pending } = useAction();
  const [productId, setProductId] = useState<string | null>(product?.id ?? null);
  const [mode, setMode] = useState<"price" | "percent">("price");
  const [price, setPrice] = useState(product ? (product.price_pence / 100).toFixed(2) : "");
  const [percent, setPercent] = useState(product ? String(percentOff(product.compare_at_pence!, product.price_pence)) : "");
  const [error, setError] = useState<string | null>(null);

  const chosen = product ?? choices.find((c) => c.id === productId) ?? null;
  const was = chosen ? normalPrice(chosen) : 0;
  const pct = Number(percent);
  const offerPence = mode === "price" ? poundsToPence(price) : percent.trim() && pct > 0 && pct < 100 ? Math.round((was * (100 - pct)) / 100) : null;
  const valid = !!chosen && offerPence != null && offerPence > 0 && offerPence < was;

  const submit = async () => {
    if (!chosen) return setError("Please choose a product.");
    if (offerPence == null || offerPence <= 0) return setError(mode === "price" ? "Please enter the offer price, like 9.50" : "Please enter a percentage between 1 and 99.");
    if (offerPence >= was) return setError(`The offer price must be lower than ${formatPence(was)}.`);
    setError(null);
    const r = await run(() => saveOffer({ productId: chosen.id, pricePence: offerPence }));
    if (r.ok) onDone();
    else setError(r.error);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {product ? (
        <p className="text-sm">
          <span className="font-medium">{product.name}</span>
          <span className="block text-stone-500">
            Normal price {formatPence(was)} {SALE_MODE_LABEL[product.sale_mode]}
          </span>
        </p>
      ) : (
        <Field label="Product" htmlFor="offer-product" hint={chosen ? `Normal price ${formatPence(was)} ${SALE_MODE_LABEL[chosen.sale_mode]}` : undefined}>
          <Dropdown
            id="offer-product"
            value={productId}
            onChange={setProductId}
            placeholder="Choose a product"
            sheetTitle="Choose a product"
            options={choices.map((c) => ({
              value: c.id,
              label: c.name,
              text: c.name,
              hint: [c.colour, `${formatPence(c.price_pence)} ${SALE_MODE_LABEL[c.sale_mode]}`, c.is_active ? null : "hidden"].filter(Boolean).join(" · "),
            }))}
          />
        </Field>
      )}

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "price", label: "Set a price" },
          { value: "percent", label: "Take a percentage off" },
        ]}
        className="w-full"
      />

      {mode === "price" ? (
        <Field label="Offer price" htmlFor="offer-price">
          <MoneyInput id="offer-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </Field>
      ) : (
        <Field label="Percentage off" htmlFor="offer-pct">
          <UnitInput id="offer-pct" unit="%" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="20" />
        </Field>
      )}

      <p className={cn("border-t border-ink/10 pt-4 text-sm", valid ? "text-ink" : "text-stone-500")}>
        {valid ? (
          <>
            Customers pay <span className="font-display text-xl text-aubergine-900">{formatPence(offerPence!)}</span>{" "}
            <span className="text-stone-500 line-through">{formatPence(was)}</span>, {percentOff(was, offerPence!)}% off.
          </>
        ) : (
          "Choose a product and a lower price to see what customers will pay."
        )}
      </p>
      {chosen && !chosen.is_active && <p className="text-xs text-stone-500">This product is hidden from the shop, so the offer shows once you switch it on.</p>}

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : product ? "Save offer" : "Start offer"}
        </Button>
      </div>
    </form>
  );
}
