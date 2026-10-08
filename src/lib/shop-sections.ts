/**
 * The shop sections the site navigation links to. Each one resolves even when it has no
 * matching row in the categories table yet (it then simply has no products), so a nav link
 * can never 404. "special-offers" is not a category: it collects every product with a was
 * price above its current price.
 */

export type Placeholder = { name: string; subtitle: string; hex: string };

export type ShopSection = {
  slug: string;
  name: string;
  description: string;
  /** "offers" gathers discounted products from every category */
  kind: "category" | "offers";
  /** stand-ins shown while the section has nothing on sale */
  placeholders: Placeholder[];
};

export const SHOP_SECTIONS: ShopSection[] = [
  {
    slug: "fabrics-and-ties",
    name: "Fabrics & Ties",
    description: "Face fabrics and finishing tiebacks for made-to-measure curtains and blinds.",
    kind: "category",
    placeholders: [
      { name: "Linen Union", subtitle: "Natural, 137cm", hex: "#D9CCB4" },
      { name: "Herringbone Wool", subtitle: "Smoke, 140cm", hex: "#8A7F72" },
      { name: "Cotton Ticking Stripe", subtitle: "Navy on cream, 140cm", hex: "#E7E1D3" },
      { name: "Silk Rope Tieback", subtitle: "Claret, pair", hex: "#6B2E3E" },
      { name: "Tassel Tieback", subtitle: "Antique gold, pair", hex: "#B08D57" },
    ],
  },
  {
    slug: "linings",
    name: "Linings",
    description: "Cotton and sateen curtain linings, cut to your length.",
    kind: "category",
    placeholders: [
      { name: "Cotton Sateen Lining", subtitle: "Ivory, 137cm", hex: "#F3EBDD" },
      { name: "Blackout Lining", subtitle: "Ivory, 137cm", hex: "#EFE6D6" },
      { name: "Thermal Lining", subtitle: "Oyster, 137cm", hex: "#E4DDD0" },
      { name: "Coloured Sateen Lining", subtitle: "Aubergine, 137cm", hex: "#4A1D5C" },
      { name: "Wide Cotton Sateen", subtitle: "Ivory, 280cm", hex: "#F1E8D6" },
    ],
  },
  {
    slug: "trimmings",
    name: "Trimmings",
    description: "Fringes, braids, piping and ribbons to finish a leading edge or a pelmet.",
    kind: "category",
    placeholders: [
      { name: "Bullion Fringe", subtitle: "Old gold, by the metre", hex: "#C9A45C" },
      { name: "Cotton Piping Cord", subtitle: "Natural, 4mm", hex: "#EFE6D6" },
      { name: "Grosgrain Ribbon", subtitle: "Aubergine, 25mm", hex: "#4A1D5C" },
      { name: "Woven Braid", subtitle: "Sage, 30mm", hex: "#7C8C74" },
      { name: "Bobble Fringe", subtitle: "Oyster, by the metre", hex: "#E4DDD0" },
    ],
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Heading tapes, hooks, weights and the small things every workroom runs on.",
    kind: "category",
    placeholders: [
      { name: "Pencil Pleat Tape", subtitle: "White, 75mm", hex: "#F4F2EC" },
      { name: "Curtain Hooks", subtitle: "Pack of 100", hex: "#C8C6C0" },
      { name: "Lead Weight Tape", subtitle: "By the metre", hex: "#9A9A96" },
      { name: "Pinch Pleat Buckram", subtitle: "Fusible, 100mm", hex: "#EDE3CF" },
      { name: "Hand Sewing Needles", subtitle: "Assorted, pack of 20", hex: "#D8D2C4" },
    ],
  },
  {
    slug: "shade-cards",
    name: "Shade Cards",
    description: "Printed cards showing every colour in a range, to match cloth at home before you order.",
    kind: "category",
    placeholders: [
      { name: "Cotton Sateen Shade Card", subtitle: "All colours, 137cm range", hex: "#F3EBDD" },
      { name: "Coloured Lining Shade Card", subtitle: "Full range", hex: "#4A1D5C" },
      { name: "Interlining Shade Card", subtitle: "Bump, domette and thermal", hex: "#E8DCC4" },
      { name: "Trimmings Shade Card", subtitle: "Fringes and braids", hex: "#C9A45C" },
      { name: "Linen Union Shade Card", subtitle: "Naturals", hex: "#D9CCB4" },
    ],
  },
  {
    slug: "special-offers",
    name: "Special Offers",
    description: "End of roll lengths, seconds and clearance cloth at reduced prices.",
    kind: "offers",
    placeholders: [
      { name: "End of Roll Sateen", subtitle: "Ivory, limited lengths", hex: "#F3EBDD" },
      { name: "Blackout Seconds", subtitle: "Minor marks, 137cm", hex: "#EFE6D6" },
      { name: "Interlining Remnants", subtitle: "Mixed bundle", hex: "#E8DCC4" },
      { name: "Clearance Coloured Sateen", subtitle: "Sage, 137cm", hex: "#A7B09A" },
      { name: "Paper Offcuts", subtitle: "Workroom bundle", hex: "#EADFC9" },
    ],
  },
];

/** Used for any category without its own stand-ins. */
export const DEFAULT_PLACEHOLDERS: Placeholder[] = [
  { name: "New cloth arriving", subtitle: "Ivory", hex: "#F1E8D6" },
  { name: "New cloth arriving", subtitle: "Oyster", hex: "#E4DDD0" },
  { name: "New cloth arriving", subtitle: "Natural", hex: "#E8DCC4" },
  { name: "New cloth arriving", subtitle: "Sage", hex: "#A7B09A" },
  { name: "New cloth arriving", subtitle: "Aubergine", hex: "#4A1D5C" },
];

export const sectionFor = (slug: string) => SHOP_SECTIONS.find((s) => s.slug === slug) ?? null;
