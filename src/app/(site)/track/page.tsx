import type { Metadata } from "next";
import { PageHeader } from "@/components/shop/bits";
import { TrackForm } from "@/components/shop/track-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the progress of your British Quilting order with your order number and email.",
  robots: { index: false },
};

export default function TrackPage() {
  return (
    <>
      <PageHeader
        eyebrow="Order tracking"
        title="Track your order"
        lede="From the cutting table to your door. No account needed."
        crumbs={[{ href: "/", label: "Home" }, { label: "Track an order" }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <TrackForm />
      </div>
    </>
  );
}
