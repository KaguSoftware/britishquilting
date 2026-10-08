-- Shade Cards becomes a real category, so shade card products can be filed under it in the admin.
-- The navbar links to /shop/shade-cards. The free swatch page (/samples) is unchanged.
insert into public.categories (slug, name, description, sort_order) values
  ('shade-cards', 'Shade Cards', 'Printed cards showing every colour in a range, to match cloth at home before you order.', 6)
on conflict (slug) do nothing;
