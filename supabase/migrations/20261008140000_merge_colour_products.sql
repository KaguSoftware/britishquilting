-- Merge products that are the same cloth in different colours into one product with colour variants.
-- Needs 20261008120000_product_variants.sql first.
--
-- A group is two or more products with the same name, way of selling, price and width
-- (e.g. "Cotton Sateen Lining" in Ivory, White and Cream). For each group:
--   * the featured / first-sorted product is kept, and every member becomes one of its colours,
--     carrying over its own colour name, shade and stock;
--   * photos, past order lines, reviews, wishlists and back-in-stock alerts move to the kept product,
--     tagged with the right colour;
--   * the other products are deleted, and the kept one gets a colour-free web address and subtitle.
-- Products that already have colours are left alone, so running this twice changes nothing.

do $$
declare
  g record;
  m record;
  keep uuid;
  vid uuid;
  n int;
  new_slug text;
begin
  for g in
    select name, sale_mode, price_pence, coalesce(width_cm, 0) as width,
           array_agg(id order by is_featured desc, sort_order, created_at) as ids
    from public.products
    where not exists (select 1 from public.product_variants v where v.product_id = products.id)
    group by name, sale_mode, price_pence, coalesce(width_cm, 0)
    having count(*) > 1
  loop
    keep := g.ids[1];
    n := 0;

    for m in
      select p.* from public.products p
      join unnest(g.ids) with ordinality as u(id, ord) on u.id = p.id
      order by u.ord
    loop
      insert into public.product_variants (product_id, name, colour_hex, stock_qty, sort_order, is_active)
      values (
        keep,
        coalesce(nullif(trim(m.colour), ''), nullif(trim(split_part(m.subtitle, '·', 1)), ''), m.slug),
        m.colour_hex,
        greatest(m.stock_qty, 0),
        n,
        m.is_active
      )
      returning id into vid;
      n := n + 1;

      -- Photos: the member's photos become this colour's photos.
      update public.product_images set product_id = keep, variant_id = vid where product_id = m.id;

      -- Past orders point at the kept product and remember the colour.
      update public.order_items
      set product_id = keep, variant_id = vid, variant_name = coalesce(variant_name, (select name from public.product_variants where id = vid))
      where product_id = m.id and variant_id is null;

      -- Back in stock alerts wait on this colour (dropping exact duplicates).
      delete from public.stock_alerts a
      where a.product_id = m.id
        and exists (select 1 from public.stock_alerts b where b.product_id = keep and b.variant_id = vid and b.email = a.email);
      update public.stock_alerts set product_id = keep, variant_id = vid where product_id = m.id;

      if m.id <> keep then
        update public.reviews set product_id = keep where product_id = m.id;
        insert into public.wishlist_items (user_id, product_id, created_at)
          select user_id, keep, created_at from public.wishlist_items where product_id = m.id
          on conflict do nothing;
        delete from public.wishlist_items where product_id = m.id;
        delete from public.products where id = m.id;
      end if;
    end loop;

    -- A colour-free web address and subtitle for the merged product.
    new_slug := trim(both '-' from regexp_replace(lower(g.name), '[^a-z0-9]+', '-', 'g'));
    if exists (select 1 from public.products where slug = new_slug and id <> keep) then
      select slug into new_slug from public.products where id = keep;
    end if;
    update public.products
    set slug = new_slug,
        subtitle = case when g.width > 0 then g.width || 'cm wide' else null end,
        is_active = true,
        rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = keep and status = 'approved'), 0),
        rating_count = (select count(*) from public.reviews where product_id = keep and status = 'approved')
    where id = keep;

    raise notice 'Merged % products into "%" (/product/%)', array_length(g.ids, 1), g.name, new_slug;
  end loop;
end $$;
