import { formatMetres } from "@/lib/utils";

export function itemDetailText(i: { sale_mode: string; is_swatch: boolean; length_m: number | string | null; quantity: number }) {
  if (i.is_swatch) return "Swatch";
  if (i.sale_mode === "metre") return `${formatMetres(Number(i.length_m ?? 0))} cut${i.quantity > 1 ? `, ${i.quantity} pieces` : ""}`;
  return `Qty ${i.quantity}`;
}
