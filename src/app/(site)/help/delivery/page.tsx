import type { Metadata } from "next";
import Link from "next/link";
import { ContentLayout, HelpAside, PageHeader, Prose } from "@/components/shop/bits";
import { getShippingRates, getStoreSettings } from "@/lib/data/catalog";
import { formatPence } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Delivery & collection",
  description: "Tracked UK delivery on cut fabric and rolls, or free collection from our London workroom.",
  alternates: { canonical: "/help/delivery" },
};

export default async function DeliveryPage() {
  const [rates, settings] = await Promise.all([getShippingRates().catch(() => []), getStoreSettings().catch(() => null)]);
  const free = settings?.free_shipping_threshold_pence;

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Delivery & collection"
        lede="Cut, checked and on its way within one to two working days. Tracked on every parcel."
        crumbs={[{ href: "/", label: "Home" }, { label: "Delivery & collection" }]}
      />
      <ContentLayout aside={<HelpAside />}>
        {rates.length > 0 && (
          <div className="mb-14">
            <h2 className="font-display text-3xl">Delivery rates</h2>
            <p className="mt-2 text-ink-soft">Priced by parcel weight, calculated at checkout.{free != null && <> Standard delivery is free on orders over {formatPence(free)}.</>}</p>
            <table className="mt-6 w-full border-t border-ink/80 text-left text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-stone-500">
                  <th scope="col" className="py-3 font-normal">Service</th>
                  <th scope="col" className="py-3 font-normal">Parcel weight</th>
                  <th scope="col" className="hidden py-3 font-normal sm:table-cell">Typically</th>
                  <th scope="col" className="py-3 text-right font-normal">Price</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b border-stone-300">
                    <td className="py-4 pr-4 text-ink">{r.name}</td>
                    <td className="py-4 pr-4 text-ink-soft tabular-nums">
                      {r.max_weight_g == null ? `Over ${(r.min_weight_g / 1000).toLocaleString("en-GB")}kg` : `Up to ${(r.max_weight_g / 1000).toLocaleString("en-GB")}kg`}
                    </td>
                    <td className="hidden py-4 pr-4 text-ink-soft sm:table-cell">{r.estimated_days ?? ""}</td>
                    <td className="py-4 text-right tabular-nums">{formatPence(r.price_pence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Prose>
          <h2>When will it arrive?</h2>
          <p>
            Orders placed before 1pm on a working day are usually cut and dispatched within one to two working days. Once your parcel leaves us you&apos;ll receive
            an email with a tracking link. You can also <Link href="/track">track your order here</Link>.
          </p>
          <h2>How it&apos;s packed</h2>
          <p>
            Long lengths are rolled onto a tube wherever possible so they arrive without creases. Shorter cuts are folded loosely and wrapped in tissue. Full rolls
            travel by courier and may need a signature.
          </p>
          <h2>Collection in London</h2>
          <p>
            Choose collection at checkout and there&apos;s nothing to pay for delivery. We&apos;ll email you when your order is cut and ready, along with the address
            {settings?.collection_hours ? <> and collection hours ({settings.collection_hours})</> : null}. Please bring your order number.
          </p>
          <h2>Outside mainland UK</h2>
          <p>
            We currently deliver to UK mainland addresses online. For the Highlands and Islands, Northern Ireland, the Channel Islands or overseas,
            please <Link href="/contact">contact us</Link> for a quote.
          </p>
          <h2>Something wrong with your delivery?</h2>
          <p>If a parcel arrives damaged or hasn&apos;t arrived within five working days of dispatch, tell us straight away and we&apos;ll put it right.</p>
        </Prose>
      </ContentLayout>
    </>
  );
}
