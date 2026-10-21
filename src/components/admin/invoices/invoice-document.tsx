import type { ReactNode } from "react";
import type { DocAction } from "@/lib/doc-action";
import { DocumentToolbar } from "@/components/admin/documents/document-toolbar";
import { AddressBox, AddressLines, Letterhead, PAD, Paper, Sheet, paginate } from "@/components/admin/documents/sheet";

/** Everything an invoice prints, already formatted. Order and manual invoices both map into this. */
export type InvoiceDoc = {
  number: string;
  date: string;
  delNoteNo?: string | null;
  customerCode?: string | null;
  poNumber?: string | null;
  invoiceTo: string[];
  deliverTo: string[];
  lines: { key: string; code?: string | null; quantity: string; description: string; price: string; amount: string }[];
  /** Rows under the goods: discount, delivery, payment due, notes. */
  extras?: { key: string; description: string; amount?: string | null }[];
  net: string;
  vat: string;
  total: string;
};

export const INVOICE_SHEET_ID = "invoice-sheet";

/** Lines that fit on one invoice page. */
export const INVOICE_ROWS = 14;
const ADDRESS = ["Unit S,", "OYO Business Units", "Hindmans Way", "Dagenham RM9 6LN"];
const COLS = "grid grid-cols-[86px_78px_1fr_100px_112px] gap-x-2 px-[16px]";

/** One line of goods. On screen, `action` sits in the sheet's right margin, level with the line. */
export function InvoiceRow({
  code,
  quantity,
  description,
  price,
  amount,
  muted,
  action,
}: {
  code?: ReactNode;
  quantity?: ReactNode;
  description?: ReactNode;
  price?: ReactNode;
  amount?: ReactNode;
  muted?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`${COLS} relative h-[25px] items-end font-sans text-[13.5px] ${muted ? "italic opacity-70" : ""}`} style={{ color: PAD.pen }}>
      <span className="truncate">{code}</span>
      <span className="truncate tabular-nums">{quantity}</span>
      <span className="truncate">{description}</span>
      <span className="text-right tabular-nums">{price}</span>
      <span className="text-right tabular-nums">{amount}</span>
      {/* In the sheet's right margin, level with the line. */}
      {action && <span className="absolute -right-[38px] bottom-[1px] print:hidden">{action}</span>}
    </div>
  );
}

function Entry({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex h-[28px] items-center gap-1.5 whitespace-nowrap text-[14px]">
      <span className="shrink-0">{label} :</span>
      <span className="min-w-0 flex-1 truncate font-sans" style={{ color: PAD.pen }}>
        {children}
      </span>
    </div>
  );
}

function Cell({ label, children, last }: { label: string; children?: ReactNode; last?: boolean }) {
  return (
    <>
      <div className={"px-2.5 pt-2 text-[14px] text-white " + (last ? "" : "border-b border-white/35")} style={{ background: PAD.navy }}>
        {label}
      </div>
      <div className={"flex items-center justify-end px-3 font-sans text-[15px] tabular-nums " + (last ? "font-semibold" : "border-b")} style={{ borderColor: PAD.ink, color: PAD.pen }}>
        {children}
      </div>
    </>
  );
}

/**
 * The invoice pad. Every box takes either printed text or, in the editor, a field to fill in.
 * `grow` lets a long invoice run past A4 on screen.
 */
export function InvoiceSheet({
  number,
  date,
  page,
  delNoteNo,
  customerCode,
  poNumber,
  invoiceTo,
  invoiceToAction,
  deliverTo,
  deliverToAction,
  rows,
  net,
  vat,
  total,
  grow,
}: {
  number: ReactNode;
  date: ReactNode;
  page: ReactNode;
  delNoteNo?: ReactNode;
  customerCode?: ReactNode;
  poNumber?: ReactNode;
  invoiceTo: ReactNode;
  invoiceToAction?: ReactNode;
  deliverTo: ReactNode;
  deliverToAction?: ReactNode;
  rows: ReactNode[];
  net?: ReactNode;
  vat?: ReactNode;
  total?: ReactNode;
  grow?: boolean;
}) {
  return (
    <Sheet grow={grow} className="px-[56px] pb-[26px] pt-[34px]">
      <header className="grid grid-cols-[1fr_210px]">
        <div>
          <Letterhead variant="invoice" className="h-[96px] w-[273px]" />
          <address className="mt-[14px] text-[16px] not-italic leading-[24px]">
            {ADDRESS.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </address>
        </div>
        <div className="pt-[10px]">
          <h1 className="text-[34px] leading-none" style={{ color: PAD.navy }}>
            Invoice
          </h1>
          <div className="mt-[14px]">
            <Entry label="Number">{number}</Entry>
            <Entry label="Date">{date}</Entry>
            <Entry label="Page">{page}</Entry>
            <Entry label="DEL Note No">{delNoteNo}</Entry>
            <Entry label="Customer Code">{customerCode}</Entry>
            <Entry label="PO Number">{poNumber}</Entry>
          </div>
        </div>
      </header>

      <section className="mt-[18px] grid grid-cols-2 gap-[30px]">
        <AddressBox label="Invoice To :" height={160} action={invoiceToAction}>
          {invoiceTo}
        </AddressBox>
        <AddressBox label="Deliver To :" height={160} action={deliverToAction}>
          {deliverTo}
        </AddressBox>
      </section>

      <div className={`${COLS} mt-[26px] h-[46px] items-center rounded-[8px] text-[18px] text-white`} style={{ background: PAD.navy }}>
        <span>CODE</span>
        <span>QTY</span>
        <span className="text-center">DESCRIPTION</span>
        <span className="text-right">PRICE</span>
        <span className="text-right">AMOUNT</span>
      </div>
      <div className="min-h-[358px] flex-1 pt-[8px]">{rows}</div>

      <footer>
        <div className="grid h-[146px] grid-cols-[298px_176px_72px_1fr] overflow-hidden rounded-[10px] border-[1.5px]" style={{ borderColor: PAD.ink }}>
          <div className="space-y-[9px] border-r pl-[32px] pt-[22px] text-[14px]" style={{ borderColor: PAD.ink }}>
            <p>Email : sales@britishquilting.com</p>
            <p>Tel : 02033498200</p>
            <p>VAT Number : 714379429</p>
            <p>Company Number : 3335461</p>
          </div>
          <div className="space-y-[9px] pl-[24px] pt-[22px] text-[14px]">
            <p>Intermode Ltd.</p>
            <p>Natwest Bank</p>
            <p>Sort Code : 60-80-01</p>
            <p>Acc. No : 37341553</p>
          </div>
          <div className="col-span-2 grid grid-cols-[72px_1fr] grid-rows-3">
            <Cell label="NET">{net}</Cell>
            <Cell label="VAT">{vat}</Cell>
            <Cell label="TOTAL" last>
              {total}
            </Cell>
          </div>
        </div>
        <p className="mt-[14px] text-center text-[11px] leading-[19px]">
          * The title of these goods remain the property of British Quilting until they are paid for in full. No claims on cut goods.
          <br />
          Examine delivery before cutting. Any shortage or discrepancies on delivery must be notified within 3 days from delivery.
        </p>
      </footer>
    </Sheet>
  );
}

type RowData = { key: string; code?: string | null; quantity?: string; description: string; price?: string; amount?: string | null; muted?: boolean };

/** A saved invoice, printed: one A4 sheet per 14 lines. */
export function InvoiceDocument({ doc, action }: { doc: InvoiceDoc; action?: DocAction | null }) {
  const rows: RowData[] = [...doc.lines, ...(doc.extras ?? [])];
  // Leave the last line of a full page for "Continued".
  const pages = paginate(rows, INVOICE_ROWS - 1);

  return (
    <Paper id={INVOICE_SHEET_ID} toolbar={<DocumentToolbar target={INVOICE_SHEET_ID} filename={`Invoice ${doc.number}`} auto={action} />}>
      {pages.map((pageRows, p) => {
        const last = p === pages.length - 1;
        const filled: RowData[] = last ? pageRows : [...pageRows, { key: "more", description: `Continued on page ${p + 2}`, muted: true }];
        return (
          <InvoiceSheet
            key={p}
            number={doc.number}
            date={doc.date}
            page={`${p + 1} of ${pages.length}`}
            delNoteNo={doc.delNoteNo}
            customerCode={doc.customerCode}
            poNumber={doc.poNumber}
            invoiceTo={<AddressLines lines={doc.invoiceTo} />}
            deliverTo={<AddressLines lines={doc.deliverTo} />}
            rows={filled.map(({ key, ...r }) => (
              <InvoiceRow key={key} {...r} />
            ))}
            net={last && doc.net}
            vat={last && doc.vat}
            total={last && doc.total}
          />
        );
      })}
    </Paper>
  );
}
