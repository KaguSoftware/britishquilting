import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/ui";
import { DiscountTabs } from "@/components/admin/discount-tabs";

/** Every way to take money off, in one place: offer prices on products, codes, and birthday treats. */
export default function DiscountsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PageHeader title="Discounts" description="Offer prices on products, codes customers type at checkout, and the automatic birthday treat." />
      <DiscountTabs />
      {children}
    </div>
  );
}
