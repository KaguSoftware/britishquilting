import type { ReactNode } from "react";
import { PAD_ROWS } from "@/lib/delivery-notes";
import { AddressBox, AddressLines, Letterhead, PAD, Paper, Sheet, paginate } from "@/components/admin/documents/sheet";

/** Everything a delivery note prints, already formatted. */
export type DeliveryNoteDoc = {
  number: string;
  date: string;
  poNumber?: string | null;
  reference?: string | null;
  invoiceTo: string[];
  deliverTo: string[];
  lines: { key: string; quantity: string; description: string; amount: string | null }[];
  total?: string | null;
  note?: string | null;
};

export const SHEET_ID = "delivery-note-sheet";

const BUSINESS = ["Unit S, Oyo Business Units, Hindmans Way", "Dagenham RM9 6LN", "Tel: 020 3349 8200", "sales@britishquilting.com", "www.britishquilting.com"];

/** One ruled line of the pad. On screen, `action` sits at the end of the line. */
export function DnRow({ quantity, description, amount, strong, muted, action }: { quantity?: ReactNode; description?: ReactNode; amount?: ReactNode; strong?: boolean; muted?: boolean; action?: ReactNode }) {
  return (
    <div className="relative flex h-[25px] items-end border-b border-dotted" style={{ borderColor: "rgb(29 27 41 / 0.45)" }}>
      <span className="w-[150px] shrink-0 truncate px-3 pb-[3px] text-center font-sans text-[14px]" style={{ color: PAD.pen }}>
        {quantity}
      </span>
      <span
        className={"flex min-w-0 flex-1 items-end gap-3 pb-[3px] pl-4 pr-2 font-sans text-[14px] " + (strong ? "font-semibold " : "") + (muted ? "italic opacity-70" : "")}
        style={{ color: PAD.pen }}
      >
        <span className={"min-w-0 flex-1 truncate " + (strong ? "text-right" : "")}>{description}</span>
        <span className={"shrink-0 text-right tabular-nums " + (action ? "w-[116px] pr-6" : "w-[96px]")}>{amount}</span>
      </span>
      {/* At the end of the line, after the amount (this pad's margin is too narrow for it). */}
      {action && <span className="absolute bottom-[2px] right-[2px] print:hidden">{action}</span>}
    </div>
  );
}

/** Dotted line with the value written on it, like the boxes at the top right of the pad. */
function Entry({ label, children, red }: { label: string; children?: ReactNode; red?: boolean }) {
  return (
    <div className="grid h-[32px] grid-cols-[118px_14px_1fr] items-end">
      <span className="pb-[2px] text-[17px]">{label}</span>
      <span className="pb-[2px] text-[17px]">:</span>
      <span className="border-b border-dotted pb-[1px] text-center font-sans text-[16px]" style={{ borderColor: PAD.ink, color: red ? PAD.red : PAD.pen }}>
        {children || " "}
      </span>
    </div>
  );
}

/**
 * The delivery note pad. Every box takes either printed text or, in the editor, a field to fill in.
 * Short notes are padded with blank ruled lines; `grow` lets a long one run past A4 on screen.
 */
export function DeliveryNoteSheet({
  number,
  date,
  poNumber,
  reference,
  invoiceTo,
  invoiceToAction,
  deliverTo,
  deliverToAction,
  rows,
  grow,
}: {
  number: ReactNode;
  date: ReactNode;
  poNumber?: ReactNode;
  reference?: ReactNode;
  invoiceTo: ReactNode;
  invoiceToAction?: ReactNode;
  deliverTo: ReactNode;
  deliverToAction?: ReactNode;
  rows: ReactNode[];
  grow?: boolean;
}) {
  return (
    <Sheet grow={grow} className="px-[26px] pb-[24px]">
      <header className="flex gap-[34px]">
        <div className="w-[284px] shrink-0">
          <Letterhead variant="delivery" className="h-[150px]" />
          <address className="mt-[12px] text-[14.5px] not-italic leading-[20px]">
            {BUSINESS.map((l) => (
              <span key={l} className="block whitespace-pre">
                {l}
              </span>
            ))}
          </address>
        </div>

        <div className="flex-1 pt-[18px]">
          <h1 className="text-[37px] font-bold leading-none">DELIVERY NOTE</h1>
          <div className="mt-[42px]">
            <Entry label="Number" red>
              {number}
            </Entry>
            <Entry label="Date">{date}</Entry>
            <Entry label="P/O Number">{poNumber}</Entry>
            <Entry label="Reference">{reference}</Entry>
          </div>
        </div>
      </header>

      <section className="mt-[18px] grid grid-cols-2 gap-[20px]">
        <AddressBox label="Invoice To:" height={156} action={invoiceToAction}>
          {invoiceTo}
        </AddressBox>
        <AddressBox label="Deliver To:" height={156} action={deliverToAction}>
          {deliverTo}
        </AddressBox>
      </section>

      <div className="mt-[14px] flex h-[29px] items-center rounded-tr-[14px] text-[16px] text-white" style={{ background: PAD.slate }}>
        <span className="w-[150px] pl-[18px]">QUANTITY</span>
        <span className="flex-1 text-center">DESCRIPTION</span>
      </div>
      <div className="relative flex-1">
        <span aria-hidden className="absolute inset-y-0 left-[150px] w-px" style={{ background: PAD.ink }} />
        {rows}
        {Array.from({ length: Math.max(0, PAD_ROWS - rows.length) }, (_, i) => (
          <DnRow key={`blank-${i}`} />
        ))}
      </div>

      <footer className="grid grid-cols-[300px_1fr] gap-6 border-t-2 pt-[10px]" style={{ borderColor: PAD.ink }}>
        <div className="space-y-[9px] pt-[2px] text-center text-[11.5px] leading-[15px]">
          <p>
            * The title of these goods remain the property of
            <br />
            British Quilting until they are paid for in full.
          </p>
          <p>Examine delivery before cutting.</p>
          <p>
            Any shortages or discrepancies on delivery must
            <br />
            be notified within 3 days from delivery.
          </p>
          <p>No claims on cut goods.</p>
        </div>
        <div className="pl-8">
          <p className="pt-[6px] text-[15.5px]">We confirm receipt of the above in good condition.</p>
          {["Signature", "Print Name", "Date"].map((l) => (
            <div key={l} className="mt-[10px] flex items-end gap-1 text-[15.5px]">
              <span>{l}:</span>
              <span className="mb-[4px] flex-1 border-b border-dotted" style={{ borderColor: PAD.ink }} />
            </div>
          ))}
        </div>
      </footer>
    </Sheet>
  );
}

type RowData = { key: string; quantity?: string; description?: string; amount?: string | null; strong?: boolean; muted?: boolean };

/** A saved delivery note, printed: one A4 sheet per 18 lines. */
export function DeliveryNoteDocument({ doc, toolbar }: { doc: DeliveryNoteDoc; toolbar?: ReactNode }) {
  const rows: RowData[] = [
    ...doc.lines,
    ...(doc.total ? [{ key: "total", description: "Total", amount: doc.total, strong: true }] : []),
    ...(doc.note ?? "")
      .split("\n")
      .filter((l) => l.trim())
      .map((l, i) => ({ key: `note-${i}`, description: l })),
  ];
  // Leave the last line of a full page for "Continued".
  const pages = paginate(rows, PAD_ROWS - 1);

  return (
    <Paper id={SHEET_ID} toolbar={toolbar}>
      {pages.map((pageRows, p) => {
        const last = p === pages.length - 1;
        const filled: RowData[] = last ? pageRows : [...pageRows, { key: "more", description: `Continued on page ${p + 2}`, muted: true }];
        return (
          <DeliveryNoteSheet
            key={p}
            number={pages.length > 1 ? `${doc.number}  (${p + 1}/${pages.length})` : doc.number}
            date={doc.date}
            poNumber={doc.poNumber}
            reference={doc.reference}
            invoiceTo={<AddressLines lines={doc.invoiceTo} />}
            deliverTo={<AddressLines lines={doc.deliverTo} />}
            rows={filled.map(({ key, ...r }) => (
              <DnRow key={key} {...r} />
            ))}
          />
        );
      })}
    </Paper>
  );
}
