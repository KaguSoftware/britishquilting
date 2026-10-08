-- Live example products so no category is empty on the shop.
--
-- 1. Removes the 15 hidden £0 drafts left by a reverted migration (only while they are still
--    untouched: hidden, unpriced and never ordered).
-- 2. Gives every category with no live products three example products, live and buyable, tagged
--    'placeholder' so staff can find them in Products and edit or replace them.
--    Categories that already have live products (Linings, Interlinings, Paper) are not touched.
-- Running it twice changes nothing.

delete from public.products p
where p.slug in (
    'linen-union', 'herringbone-wool', 'cotton-ticking-stripe', 'silk-rope-tieback', 'tassel-tieback',
    'bullion-fringe', 'cotton-piping-cord', 'grosgrain-ribbon', 'woven-braid', 'bobble-fringe',
    'pencil-pleat-tape', 'curtain-hooks', 'lead-weight-tape', 'pinch-pleat-buckram', 'hand-sewing-needles'
  )
  and not p.is_active
  and p.price_pence = 0
  and not exists (select 1 from public.order_items i where i.product_id = p.id);

insert into public.products (
  slug, name, subtitle, description, category_id, sale_mode, price_pence, trade_price_pence,
  min_length_m, length_step_m, weight_g_per_unit, swatch_enabled, stock_qty,
  colour, colour_hex, composition, width_cm, weight_gsm, tags, is_active, sort_order
)
select v.slug, v.name, v.subtitle, v.description, c.id, v.mode::public.sale_mode, v.price, v.trade,
       case when v.mode = 'metre' then 0.5 end, case when v.mode = 'metre' then 0.5 end,
       v.weight, v.mode <> 'unit', v.stock,
       v.colour, v.hex, v.comp, v.width, v.gsm, '{placeholder}', true, v.sort
from (values
  -- Fabrics & Ties
  ('linen-union', 'Linen Union', 'Natural, 137cm wide',
   'A hard-wearing linen and cotton union with a soft, slubby handle. The classic face cloth for country-house curtains and loose covers.',
   'fabrics-and-ties', 'metre', 1895, 1520, 330, 120, 'Natural', '#D9CCB4', 'Linen / Cotton', 137, 280, 0),
  ('cotton-ticking-stripe', 'Cotton Ticking Stripe', 'Navy on cream, 140cm wide',
   'A tightly woven ticking stripe that makes crisp Roman blinds and unlined kitchen curtains.',
   'fabrics-and-ties', 'metre', 1450, 1160, 300, 90, 'Navy on cream', '#E7E1D3', '100% Cotton', 140, 250, 1),
  ('silk-rope-tieback', 'Silk Rope Tieback', 'Claret, pair',
   'A pair of twisted rope tiebacks with brass rings, to hold a curtain back in a generous curve.',
   'fabrics-and-ties', 'unit', 2400, 1900, 250, 20, 'Claret', '#6B2E3E', 'Viscose', null, null, 2),
  -- Trimmings
  ('bullion-fringe', 'Bullion Fringe', 'Old gold, 15cm drop',
   'A heavy twisted bullion fringe for the leading edge of formal curtains or the hem of a pelmet.',
   'trimmings', 'metre', 1295, 1040, 120, 60, 'Old gold', '#C9A45C', 'Viscose / Cotton', null, null, 0),
  ('cotton-piping-cord', 'Cotton Piping Cord', 'Natural, 4mm',
   'Pre-shrunk cotton cord for piping cushions, loose covers and blind edges.',
   'trimmings', 'metre', 145, 115, 20, 400, 'Natural', '#EFE6D6', '100% Cotton', null, null, 1),
  ('woven-braid', 'Woven Braid', 'Sage, 30mm',
   'A flat woven braid to set in from a leading edge or run along a pelmet.',
   'trimmings', 'metre', 595, 475, 40, 80, 'Sage', '#7C8C74', 'Cotton / Viscose', null, null, 2),
  -- Accessories
  ('pencil-pleat-tape', 'Pencil Pleat Tape', 'White, 75mm',
   'Three-cord pencil pleat heading tape. Allow two and a half times the track width.',
   'accessories', 'metre', 165, 130, 30, 500, 'White', '#F4F2EC', 'Polyester', null, null, 0),
  ('curtain-hooks', 'Curtain Hooks', 'Pack of 100',
   'Standard white plastic hooks for pencil pleat and gathered heading tapes.',
   'accessories', 'unit', 450, 360, 150, 80, null, '#C8C6C0', 'Plastic', null, null, 1),
  ('lead-weight-tape', 'Lead Weight Tape', 'By the metre',
   'Fine lead chain in a woven sleeve, laid into the hem so curtains hang straight and still.',
   'accessories', 'metre', 395, 315, 180, 150, null, '#9A9A96', 'Lead in a polyester sleeve', null, null, 2),
  -- Shade Cards
  ('cotton-sateen-shade-card', 'Cotton Sateen Shade Card', 'Every lining colour',
   'A printed card with a cutting of every cotton sateen lining colour we stock.',
   'shade-cards', 'unit', 300, 240, 60, 50, null, '#F3EBDD', null, null, null, 0),
  ('interlining-shade-card', 'Interlining Shade Card', 'Bump, domette, flannelette and sarille',
   'Cuttings of each interlining side by side, so you can feel the difference in weight and loft.',
   'shade-cards', 'unit', 300, 240, 60, 50, null, '#E8DCC4', null, null, null, 1),
  ('trimmings-shade-card', 'Trimmings Shade Card', 'Fringes and braids',
   'A card of every fringe and braid colour, to hold against your face fabric at home.',
   'shade-cards', 'unit', 300, 240, 60, 50, null, '#C9A45C', null, null, null, 2)
) as v(slug, name, subtitle, description, cat, mode, price, trade, weight, stock, colour, hex, comp, width, gsm, sort)
join public.categories c on c.slug = v.cat
where not exists (select 1 from public.products p where p.category_id = c.id and p.is_active)
on conflict (slug) do nothing;
