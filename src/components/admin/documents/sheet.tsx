import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Colours taken from the printed British Quilting pads. */
export const PAD = {
  ink: "#1d1b29", // the printing
  pen: "#1f2547", // what gets filled in
  red: "#c0392b", // the delivery note number
  navy: "#3d3f72", // invoice letterhead and bars
  slate: "#2f2b45", // delivery note heading bar
};

/** Splits rows into pages; there is always at least one page. */
export function paginate<T>(rows: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

/** The desk the sheets lie on, with the toolbar above. `id` is what the PDF download captures. */
export function Paper({ id, toolbar, children }: { id: string; toolbar?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-cream-200 pb-10 print:min-h-0 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 0; } @media print { .grain::after { display: none !important; } body { background: #fff !important; } [data-sheet] { break-after: page; } [data-sheet]:last-child { break-after: auto; } }`}</style>
      {toolbar}
      <div className="overflow-x-auto print:overflow-visible">
        <div id={id} className="space-y-6 print:space-y-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/** One A4 page. `grow` lets it run longer than A4, for filling it in on screen. */
export function Sheet({ children, className, grow }: { children: ReactNode; className?: string; grow?: boolean }) {
  return (
    <article
      data-sheet
      className={cn(
        "relative mx-auto flex w-[210mm] flex-col bg-white font-serif shadow-[0_1px_3px_rgb(0_0_0/0.12)] [print-color-adjust:exact] print:shadow-none",
        grow ? "min-h-[297mm]" : "h-[297mm] overflow-hidden",
        className,
      )}
      style={{ color: PAD.ink }}
    >
      {children}
    </article>
  );
}

/**
 * The BQ panel at the top left of both pads. The delivery note pad has a square purple panel with white
 * rules; the invoice pad has a rounded navy one with gold rules and a gold "Since 1990".
 */
export function Letterhead({ variant, className }: { variant: "delivery" | "invoice"; className?: string }) {
  const invoice = variant === "invoice";
  return (
    <div
      className={cn("flex flex-col items-center justify-center text-white", invoice ? "rounded-[4px]" : "bg-aubergine-700", className)}
      style={invoice ? { background: PAD.navy } : undefined}
    >
      <div className="flex w-[78%] items-end gap-2">
        <span className={cn("mb-[3px] h-px flex-1", invoice ? "bg-gold-500" : "bg-white/75")} />
        <svg viewBox="0 0 64 40" className="w-[20px] text-gold-500" aria-hidden>
          {invoice ? (
            <path d="M4 10 L18 24 L32 4 L46 24 L60 10 L54 36 H10 Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
          ) : (
            <path d="M4 10 L18 24 L32 4 L46 24 L60 10 L54 36 H10 Z" fill="currentColor" />
          )}
        </svg>
        <span className={cn("mb-[3px] h-px flex-1", invoice ? "bg-gold-500" : "bg-white/75")} />
      </div>
      <p className="mt-[8px] text-[25px] leading-none">BRITISH QUILTING</p>
      <p className={cn("mt-[7px] leading-none", invoice ? "text-[15px] text-gold-500" : "text-[12.5px]")}>SINCE 1990</p>
    </div>
  );
}

/** "Invoice To:" and "Deliver To:" with their rounded boxes. `action` sits beside the label, on screen only. */
export function AddressBox({ label, height, action, children, className }: { label: string; height: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-[17px] items-end justify-between gap-3">
        <p className="text-[17px] leading-none">{label}</p>
        {action && <div className="flex gap-3 font-sans text-xs print:hidden">{action}</div>}
      </div>
      <div className="mt-[10px] overflow-hidden rounded-[11px] border-[1.5px] px-5 py-4" style={{ borderColor: PAD.ink, height }}>
        {children}
      </div>
    </div>
  );
}

/** Address lines as written in a box, the first one (the name) in bold. */
export function AddressLines({ lines, skipFirst }: { lines: string[]; skipFirst?: boolean }) {
  return lines.map((l, i) =>
    skipFirst && i === 0 ? null : (
      <p key={i} className={cn("truncate font-sans text-[15px] leading-[20px]", i === 0 && "font-semibold")} style={{ color: PAD.pen }}>
        {l}
      </p>
    ),
  );
}

/** A borderless field that sits on a printed line, in pen colour. */
export const padInput =
  "w-full min-w-0 rounded-[2px] bg-transparent font-sans [font-size:inherit] text-[#1f2547] outline-none transition-colors placeholder:text-[#1f2547]/30 hover:bg-gold-100/50 focus:bg-gold-100 aria-invalid:text-danger aria-invalid:bg-danger/10";

/** Small text button for the margins of a sheet being filled in. */
export function PadAction({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="text-aubergine-700 underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-40">
      {children}
    </button>
  );
}
