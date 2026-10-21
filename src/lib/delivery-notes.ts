/** Delivery notes: shared types and maths for the editor (client) and the actions (server). */
import type { BillTo } from "@/lib/invoices";

export type DeliveryLine = {
  /** As printed in the QUANTITY column: "20 mtrs", "6 rolls". */
  quantity: string;
  /** The product's name and colour: "Cotton Sateen Lining, Red". */
  description: string;
  amount_pence: number | null;
  /** The product picked from the search. Lines written before products had to be picked have none of these. */
  code?: string | null;
  qty?: number | null;
  unit_price_pence?: number | null;
  /** "per metre", "per roll", "each" */
  per?: string | null;
};

const UNIT: Record<string, [one: string, many: string]> = { "per metre": ["mtr", "mtrs"], "per roll": ["roll", "rolls"] };
const PER_SHORT: Record<string, string> = { "per metre": " mt", "per roll": " roll", each: " each" };

const amountOf = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/** "20 mtrs", "1 roll", "6" */
export function qtyLabel(qty: number, per: string | null | undefined) {
  const unit = UNIT[per ?? ""];
  return unit ? `${amountOf(qty)} ${qty === 1 ? unit[0] : unit[1]}` : amountOf(qty);
}

/** Quantity times price, to the penny. */
export const lineAmountPence = (qty: number, unitPence: number) => Math.round(qty * unitPence);

/** The line as the pad shows it: "LIN3RED Cotton Sateen Lining, Red @ £4.95 mt". Older free-text lines as written. */
export function padLineText(l: Pick<DeliveryLine, "code" | "description" | "unit_price_pence" | "per">, money: (p: number) => string) {
  if (!l.code || l.unit_price_pence == null) return l.description;
  return `${l.code} ${l.description} @ ${money(l.unit_price_pence)}${PER_SHORT[l.per ?? ""] ?? ""}`;
}

export type DeliveryNote = {
  id: string;
  number: number;
  customer_id: string | null;
  invoice_to: BillTo;
  deliver_to: string | null;
  po_number: string | null;
  reference: string | null;
  items: DeliveryLine[];
  total_pence: number;
  issued_on: string;
  note: string | null;
};

export const deliveryNoteNo = (n: number) => `DN-${n}`;

export const deliveryTotal = (lines: Pick<DeliveryLine, "amount_pence">[]) => lines.reduce((s, l) => s + (l.amount_pence ?? 0), 0);

/** The pad has room for this many lines; shorter notes are padded with blank ruled rows. */
export const PAD_ROWS = 18;

/** "2026-10-07" as the pad writes it: 07/10/2026. */
export const padDate = (day: string) => day.slice(0, 10).split("-").reverse().join("/");

/** A delivery note an invoice can point at, with what it can fill in on the invoice. */
export type DeliveryNoteOption = Pick<DeliveryNote, "id" | "number" | "customer_id" | "deliver_to" | "po_number" | "issued_on">;
