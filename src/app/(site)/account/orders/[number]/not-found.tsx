import { ButtonLink } from "@/components/ui/button";

export default function OrderNotFound() {
  return (
    <div className="border-t-2 border-aubergine-900 pt-10">
      <p className="font-display text-3xl text-aubergine-900">We can&apos;t find that order</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        It may have been placed with a different email address. Guest orders appear here once the email they were placed with is confirmed on this account.
      </p>
      <ButtonLink href="/account/orders" className="mt-7">View your orders</ButtonLink>
    </div>
  );
}
