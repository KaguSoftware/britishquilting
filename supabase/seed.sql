-- Placeholder catalogue. Replace prices and copy from the admin panel.
insert into public.categories (slug, name, description, sort_order) values
  ('linings', 'Linings', 'Cotton and sateen curtain linings, cut to your length.', 1),
  ('interlinings', 'Interlinings', 'Bump, domette and thermal interlinings for fuller, warmer drapes.', 2),
  ('paper', 'Paper', 'Pattern and tissue paper for the workroom.', 3)
on conflict (slug) do nothing;

insert into public.products (slug, name, subtitle, description, category_id, sale_mode, price_pence, trade_price_pence,
  roll_length_m, weight_g_per_unit, stock_qty, colour, colour_hex, composition, width_cm, weight_gsm, is_active, is_featured, sort_order)
select v.slug, v.name, v.subtitle, v.description, c.id, v.mode::public.sale_mode, v.price, v.trade, v.roll, v.weight, v.stock,
       v.colour, v.hex, v.comp, v.width, v.gsm, true, v.featured, v.sort
from (values
  ('ivory-cotton-sateen-lining', 'Cotton Sateen Lining', 'Ivory · 137cm', 'A soft, lustrous 100% cotton sateen: the workroom standard for hand-finished curtains.', 'linings', 'metre', 495, 395, null::numeric, 180, 850, 'Ivory', '#F3EBDD', '100% Cotton', 137, 120, true, 1),
  ('white-cotton-sateen-lining', 'Cotton Sateen Lining', 'White · 137cm', 'Crisp white cotton sateen with a gentle sheen.', 'linings', 'metre', 495, 395, null, 180, 620, 'White', '#FAFAF7', '100% Cotton', 137, 120, false, 2),
  ('blackout-lining', 'Blackout Lining', 'Ivory · 137cm', 'Three-pass blackout coating for bedrooms and nurseries.', 'linings', 'metre', 795, 650, null, 320, 400, 'Ivory', '#EFE6D6', 'Polyester / Cotton', 137, 260, true, 3),
  ('cotton-bump-interlining', 'Cotton Bump Interlining', 'Natural · 137cm', 'Heavyweight bump for luxurious fullness and insulation.', 'interlinings', 'metre', 895, 720, null, 420, 300, 'Natural', '#E8DCC4', '100% Cotton', 137, 330, true, 4),
  ('domette-interlining', 'Domette Interlining', 'Natural · 137cm', 'Lighter than bump, ideal for blinds and lighter drapes.', 'interlinings', 'metre', 645, 520, null, 250, 280, 'Natural', '#EDE3CF', 'Cotton / Poly', 137, 200, false, 5),
  ('bump-full-roll', 'Cotton Bump, Full Roll', '50m roll · 137cm', 'The full 50 metre roll for workrooms.', 'interlinings', 'roll', 37500, 31000, 50, 21000, 12, 'Natural', '#E8DCC4', '100% Cotton', 137, 330, false, 6),
  ('pattern-paper-pack', 'Dot & Cross Pattern Paper', '10 sheets · A0', 'Marked 1-inch dot and cross paper for accurate pattern drafting.', 'paper', 'unit', 1250, 990, null, 600, 140, null, null, null, null, null, true, 7),
  ('acid-free-tissue', 'Acid-free Tissue', '50 sheets', 'For storing and wrapping heirloom textiles.', 'paper', 'unit', 950, 750, null, 400, 90, null, null, null, null, null, false, 8)
) as v(slug, name, subtitle, description, cat, mode, price, trade, roll, weight, stock, colour, hex, comp, width, gsm, featured, sort)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

insert into public.shipping_rates (name, carrier, min_weight_g, max_weight_g, price_pence, estimated_days, sort_order) values
  ('Royal Mail Tracked 48', 'royal_mail', 0, 2000, 495, '2–3 working days', 1),
  ('Royal Mail Tracked 48', 'royal_mail', 2001, 10000, 895, '2–3 working days', 2),
  ('DPD Next Day', 'dpd', 0, 30000, 1295, 'Next working day', 3),
  ('Parcelforce 48 (heavy)', 'parcelforce', 30001, null, 2495, '2 working days', 4);
