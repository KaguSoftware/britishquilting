-- Categories behind the site navigation, so products can be filed under them in the admin.
-- Special Offers is not a category: it lists every product with a was price above its price.
insert into public.categories (slug, name, description, sort_order) values
  ('fabrics-and-ties', 'Fabrics & Ties', 'Face fabrics and finishing tiebacks for made-to-measure curtains and blinds.', 0),
  ('trimmings', 'Trimmings', 'Fringes, braids, piping and ribbons to finish a leading edge or a pelmet.', 4),
  ('accessories', 'Accessories', 'Heading tapes, hooks, weights and the small things every workroom runs on.', 5)
on conflict (slug) do nothing;
