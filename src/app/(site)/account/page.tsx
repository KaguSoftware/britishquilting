import Link from "next/link";
import { IconArrowRight, IconHeart, IconParcel, IconPin, IconSettings, IconSpool } from "@/components/icons";
import { OrderLedger } from "@/components/account/order-ledger";
import { EmptyState, SectionHead } from "@/components/account/section";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { getMyAddresses, getMyOrders, getTradeInfo, requireViewer } from "@/lib/data/account";

export const metadata = { title: "Overview" };

export default async function AccountOverview({ searchParams }: PageProps<"/account">) {
  const viewer = await requireViewer("/account");
  const sp = await searchParams;
  const [orders, addresses, trade] = await Promise.all([
    getMyOrders(viewer.id, 3),
    getMyAddresses(viewer.id),
    getTradeInfo(viewer.id),
  ]);
  const def = addresses.find((a) => a.is_default) ?? addresses[0];

  const links = [
    { href: "/account/orders", label: "Orders", note: "History, tracking and receipts", icon: IconParcel },
    { href: "/account/addresses", label: "Addresses", note: def ? `${def.line1}, ${def.postcode}` : "Save a delivery address", icon: IconPin },
    { href: "/account/wishlist", label: "Wishlist", note: "Cloths you have saved", icon: IconHeart },
    {
      href: "/account/trade",
      label: "Trade account",
      note:
        trade.status === "approved" ? "Trade pricing is active" : trade.status === "pending" ? "Application under review" : "Workroom pricing and invoice terms",
      icon: IconSpool,
    },
    { href: "/account/settings", label: "Settings", note: "Details, password, emails", icon: IconSettings },
  ];

  return (
    <div className="space-y-16 md:space-y-20">
      {sp.password === "updated" && <FormMessage tone="success">Your password has been updated.</FormMessage>}

      <section>
        <SectionHead
          n="i."
          title="Recent orders"
          aside={
            orders.length > 0 && (
              <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-aubergine-700 underline-offset-4 hover:underline">
                All orders <IconArrowRight className="size-4" />
              </Link>
            )
          }
        />
        {orders.length ? (
          <OrderLedger orders={orders} />
        ) : (
          <EmptyState
            icon={<IconParcel className="size-8" strokeWidth={1.25} />}
            title="No orders yet"
            action={<ButtonLink href="/shop/linings">Browse linings</ButtonLink>}
          >
            When you place an order it will appear here, with tracking as soon as it leaves the workroom. Past guest orders appear once your email is confirmed.
          </EmptyState>
        )}
      </section>

      <section>
        <SectionHead n="ii." title="Your account at a glance" />
        <ul className="grid border-t border-stone-300 sm:grid-cols-2">
          {links.map(({ href, label, note, icon: Icon }) => (
            <li key={href} className="border-b border-stone-300 sm:odd:border-r sm:odd:pr-6 sm:even:pl-6">
              <Link href={href} className="group flex items-center gap-4 py-5">
                <Icon className="size-5 shrink-0 text-gold-600" strokeWidth={1.25} />
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-xl text-aubergine-900">{label}</span>
                  <span className="block truncate text-sm text-ink-soft">{note}</span>
                </span>
                <IconArrowRight className="size-4 text-stone-500 transition-transform duration-300 ease-(--ease-silk) group-hover:translate-x-1 group-hover:text-aubergine-700" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 border-t border-stone-300 pt-10 md:grid-cols-[1fr_1.4fr] md:gap-14">
        <p className="font-display text-2xl leading-snug text-aubergine-900">Need a hand with an order or a length you can&apos;t find?</p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Our cutting room is open weekdays. Call us, or write and quote your order number and we&apos;ll reply the same day wherever we can.{" "}
          <Link href="/contact" className="text-aubergine-700 underline underline-offset-4">Contact the workroom</Link>
        </p>
      </section>
    </div>
  );
}

