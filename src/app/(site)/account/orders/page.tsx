import { IconParcel } from "@/components/icons";
import { OrderLedger } from "@/components/account/order-ledger";
import { EmptyState, SectionHead } from "@/components/account/section";
import { ButtonLink } from "@/components/ui/button";
import { getMyOrders, requireViewer } from "@/lib/data/account";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const viewer = await requireViewer("/account/orders");
  const orders = await getMyOrders(viewer.id);

  return (
    <section>
      <SectionHead title="Orders">
        {orders.length
          ? `${orders.length} ${orders.length === 1 ? "order" : "orders"} on your account, newest first.`
          : "Everything you order with us, in one place."}
      </SectionHead>
      {orders.length ? (
        <OrderLedger orders={orders} />
      ) : (
        <EmptyState
          icon={<IconParcel className="size-8" strokeWidth={1.25} />}
          title="No orders yet"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/shop/linings">Shop linings</ButtonLink>
              <ButtonLink href="/samples" variant="secondary">Order swatches</ButtonLink>
            </div>
          }
        >
          Ordered as a guest before? Those orders are linked automatically once you confirm this email address.
        </EmptyState>
      )}
    </section>
  );
}
