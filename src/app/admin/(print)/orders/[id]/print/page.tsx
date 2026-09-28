import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { addressLines, cutInstruction, formatDate, type Address } from "@/components/admin/format";
import { PrintButton } from "@/components/admin/orders/print-button";

export const metadata = { title: "Packing slip" };

export default async function PackingSlip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data: order }, { data: items }] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(),
    db.from("order_items").select("*").eq("order_id", id),
  ]);
  if (!order) notFound();
  const ship = addressLines(order.shipping_address as Address | null);

  return (
    <div className="min-h-svh bg-white text-black print:min-h-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { .grain::after { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="mx-auto max-w-[760px] px-8 py-10 print:p-0">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <p className="text-sm text-stone-500">This page is set up for printing on A4.</p>
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b-2 border-black pb-5">
          <div>
            <p className="font-display text-3xl">British Quilting</p>
            <p className="text-sm">Packing slip</p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl tabular-nums">#{order.number}</p>
            <p className="text-sm">{formatDate(order.created_at)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase">{order.fulfilment === "collection" ? "Collecting in person" : "Deliver to"}</p>
            {order.fulfilment === "collection" ? (
              <p className="text-lg">{(order.shipping_address as Address | null)?.full_name ?? order.email}</p>
            ) : (
              <address className="text-lg not-italic leading-snug">
                {ship.map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </address>
            )}
          </div>
          <div className="text-sm leading-relaxed">
            <p><span className="font-semibold">Email:</span> {order.email}</p>
            {order.shipping_name && <p><span className="font-semibold">Service:</span> {order.shipping_name}</p>}
            {order.is_trade && <p className="font-semibold">Trade order</p>}
          </div>
        </section>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y-2 border-black text-xs uppercase">
              <th className="w-10 py-2">Done</th>
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Cut / pick</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="border-b border-black/30 align-middle">
                <td className="py-4">
                  <span className="inline-block size-5 border-2 border-black" />
                </td>
                <td className="py-4 pr-4 text-lg">{i.name}</td>
                <td className="py-4 text-right font-display text-3xl tabular-nums">{cutInstruction({ ...i, length_m: i.length_m == null ? null : Number(i.length_m) })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.customer_note && (
          <div className="mt-6 border-2 border-black p-4">
            <p className="text-xs font-semibold uppercase">Customer note</p>
            <p className="mt-1 text-lg">{order.customer_note}</p>
          </div>
        )}
        {order.internal_note && (
          <div className="mt-4 border border-dashed border-black p-4">
            <p className="text-xs font-semibold uppercase">Staff note</p>
            <p className="mt-1">{order.internal_note}</p>
          </div>
        )}

        <footer className="mt-10 border-t border-black pt-4 text-center text-sm">
          Thank you for shopping with British Quilting. Family-run in London since 1990.
        </footer>
      </div>
    </div>
  );
}
