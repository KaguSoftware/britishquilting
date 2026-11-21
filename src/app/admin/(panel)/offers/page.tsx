import { redirect } from "next/navigation";

/** Special offers now live under Discounts. */
export default function OffersPage() {
  redirect("/admin/discounts/offers");
}
