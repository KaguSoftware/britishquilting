/** What a document page does as soon as it opens, from `?do=` on the list buttons. */
export type DocAction = "print" | "pdf";
export const docAction = (v: string | undefined): DocAction | null => (v === "print" || v === "pdf" ? v : null);
