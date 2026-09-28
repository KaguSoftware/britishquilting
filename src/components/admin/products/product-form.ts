import { penceToPounds } from "../format";
import type { EditorImage } from "./image-manager";

export type ProductForm = {
  id: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  subtitle: string;
  description: string;
  category_id: string;
  sale_mode: "metre" | "roll" | "unit";
  price: string;
  trade_price: string;
  compare_at: string;
  cost_price: string;
  min_length_m: string;
  length_step_m: string;
  max_length_m: string;
  roll_length_m: string;
  weight_g_per_unit: string;
  swatch_enabled: boolean;
  swatch_price: string;
  stock_qty: string;
  low_stock_threshold: string;
  track_stock: boolean;
  colour: string;
  colour_hex: string;
  composition: string;
  width_cm: string;
  weight_gsm: string;
  care: string;
  tags: string;
  is_active: boolean;
  is_featured: boolean;
  seo_title: string;
  seo_description: string;
  images: EditorImage[];
};

export function toForm(p: Record<string, unknown> | null, images: EditorImage[], id: string): ProductForm {
  const s = (v: unknown) => (v == null ? "" : String(v));
  const n = (v: unknown) => (v == null ? "" : String(Number(v)));
  return {
    id,
    name: s(p?.name),
    slug: s(p?.slug),
    slugTouched: Boolean(p),
    subtitle: s(p?.subtitle),
    description: s(p?.description),
    category_id: s(p?.category_id),
    sale_mode: ((p?.sale_mode as string) ?? "metre") as ProductForm["sale_mode"],
    price: penceToPounds(p?.price_pence as number | null),
    trade_price: penceToPounds(p?.trade_price_pence as number | null),
    compare_at: penceToPounds(p?.compare_at_pence as number | null),
    cost_price: penceToPounds(p?.cost_price_pence as number | null),
    min_length_m: p ? n(p.min_length_m) : "0.5",
    length_step_m: p ? n(p.length_step_m) : "0.5",
    max_length_m: n(p?.max_length_m),
    roll_length_m: n(p?.roll_length_m),
    weight_g_per_unit: p ? s(p.weight_g_per_unit) : "",
    swatch_enabled: p ? Boolean(p.swatch_enabled) : true,
    swatch_price: p ? penceToPounds(p.swatch_price_pence as number) : "0.00",
    stock_qty: p ? n(p.stock_qty) : "0",
    low_stock_threshold: p ? n(p.low_stock_threshold) : "10",
    track_stock: p ? Boolean(p.track_stock) : true,
    colour: s(p?.colour),
    colour_hex: s(p?.colour_hex),
    composition: s(p?.composition),
    width_cm: s(p?.width_cm),
    weight_gsm: s(p?.weight_gsm),
    care: s(p?.care),
    tags: ((p?.tags as string[] | undefined) ?? []).join(", "),
    is_active: p ? Boolean(p.is_active) : false,
    is_featured: p ? Boolean(p.is_featured) : false,
    seo_title: s(p?.seo_title),
    seo_description: s(p?.seo_description),
    images,
  };
}
