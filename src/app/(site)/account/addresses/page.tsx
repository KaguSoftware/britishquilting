import { AddressBook } from "@/components/account/address-book";
import { SectionHead } from "@/components/account/section";
import { getMyAddresses, requireViewer } from "@/lib/data/account";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const viewer = await requireViewer("/account/addresses");
  const addresses = await getMyAddresses(viewer.id);
  return (
    <section>
      <SectionHead title="Addresses">Your default address is filled in for you at checkout. We deliver across the UK mainland and islands.</SectionHead>
      <AddressBook addresses={addresses} />
    </section>
  );
}
