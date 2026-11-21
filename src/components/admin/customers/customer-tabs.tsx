import Link from "next/link";
import { cn } from "@/lib/utils";

export const CUSTOMER_VIEWS = [
  { key: "all", label: "All customers", href: "/admin/customers" },
  { key: "accounts", label: "With an account", href: "/admin/customers?view=accounts" },
  { key: "guests", label: "Without an account", href: "/admin/customers?view=guests" },
  { key: "manual", label: "Added by hand", href: "/admin/customers?view=manual" },
  { key: "companies", label: "Companies", href: "/admin/customers/companies" },
] as const;
export type CustomerView = (typeof CUSTOMER_VIEWS)[number]["key"];

/** The views along the top of the Customers pages. */
export function CustomerTabs({ active }: { active: CustomerView }) {
  return (
    <div className="mb-5 flex overflow-x-auto rounded-[3px] border border-ink/15 bg-cream-50 p-0.5 text-sm sm:inline-flex">
      {CUSTOMER_VIEWS.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          className={cn("flex-1 shrink-0 whitespace-nowrap rounded-[2px] px-3 py-1.5 text-center", v.key === active ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
