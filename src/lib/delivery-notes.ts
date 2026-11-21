/** Delivery notes: shared types and maths for the editor (client) and the actions (server). */
import { lineAmount, type BillTo, type InvoiceLine } from "./invoices";

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
  /** Which delivery place (index into destinations) the line goes to. Older notes have one place and no index. */
  place?: number | null;
  /** The invoice line it comes from (index into the invoice's items). */
  line?: number | null;
};

/** How many of one invoice line go to a place. */
export type DestinationItem = { line: number; qty: number };

/** One place the goods go to, with its own share of the invoice. */
export type Destination = { label: string; address: string; items: DestinationItem[] };

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
  invoice_id: string | null;
  customer_id: string | null;
  company_id: string | null;
  destinations: Destination[];
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

/* ───────────────────────── splitting an invoice across delivery places */

type Line = Pick<InvoiceLine, "code" | "description" | "quantity" | "unit_price_pence">;

const EPS = 1e-6;
const round = (n: number) => Math.round(n * 1000) / 1000;

/** For each invoice line: how many were ordered, how many are given a place, and how many are left over. */
export function allocation(lines: Line[], destinations: Destination[]) {
  return lines.map((l, i) => {
    const allocated = round(destinations.reduce((s, d) => s + d.items.filter((x) => x.line === i).reduce((t, x) => t + (Number.isFinite(x.qty) ? x.qty : 0), 0), 0));
    return { line: i, ordered: l.quantity, allocated, remaining: round(l.quantity - allocated) };
  });
}

/** Everything stopping the note being saved; empty when every invoice line is fully and exactly delivered. */
export function allocationErrors(lines: Line[], destinations: Destination[]): string[] {
  const errors: string[] = [];
  if (!lines.length) errors.push("The invoice has no products to deliver.");
  if (!destinations.length) errors.push("Add at least one delivery place.");
  destinations.forEach((d, p) => {
    const name = d.label.trim() || `Place ${p + 1}`;
    if (!d.items.length) errors.push(`${name} has nothing going to it.`);
    if (!d.address.trim()) errors.push(`${name} needs an address (or "Collected").`);
    for (const x of d.items) {
      if (!lines[x.line]) errors.push(`${name} has a product that isn't on the invoice any more.`);
      else if (!(x.qty > 0)) errors.push(`${name}: how many ${lines[x.line].description}?`);
    }
  });
  for (const a of allocation(lines, destinations)) {
    const l = lines[a.line];
    if (a.remaining > EPS) errors.push(`${amountOf(a.remaining)} of ${l.description} still need a place.`);
    else if (a.remaining < -EPS) errors.push(`${amountOf(-a.remaining)} too many of ${l.description}: the invoice has ${amountOf(a.ordered)}.`);
  }
  return errors;
}

/** The value of what goes to one place, at the invoice's prices. */
export function destinationTotal(lines: Line[], d: Destination) {
  return d.items.reduce((s, x) => s + (lines[x.line] ? lineAmount({ quantity: x.qty, unit_price_pence: lines[x.line].unit_price_pence }) : 0), 0);
}

/** The note's lines, place by place, as saved and printed. */
export function destinationLines(lines: Line[], destinations: Destination[]): DeliveryLine[] {
  return destinations.flatMap((d, place) =>
    d.items
      .filter((x) => lines[x.line])
      .map((x) => {
        const l = lines[x.line];
        return {
          place,
          line: x.line,
          code: l.code ?? null,
          description: l.description,
          qty: x.qty,
          unit_price_pence: l.unit_price_pence,
          per: null,
          quantity: qtyLabel(x.qty, null),
          amount_pence: lineAmount({ quantity: x.qty, unit_price_pence: l.unit_price_pence }),
        };
      }),
  );
}

/** The saved lines grouped by place (older notes put everything in the first place). */
export function linesByPlace(items: DeliveryLine[], places: number) {
  const out: DeliveryLine[][] = Array.from({ length: Math.max(1, places) }, () => []);
  for (const l of items) out[Math.min(out.length - 1, Math.max(0, l.place ?? 0))].push(l);
  return out;
}

/** "Site A +1 more" for lists. */
export function placesSummary(destinations: Destination[], fallback: string | null) {
  const first = destinations[0];
  const name = first ? first.label.trim() || first.address.split("\n")[0] : fallback?.split("\n")[0];
  if (!name) return null;
  return destinations.length > 1 ? `${name} +${destinations.length - 1} more` : name;
}
