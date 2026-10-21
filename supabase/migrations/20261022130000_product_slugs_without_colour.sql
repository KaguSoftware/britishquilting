-- Product web addresses are the product's code without the colour letters: /product/lin5, not /product/lin5oys.
-- The colour is chosen on the page (or with ?colour=). Old addresses are remembered and redirect, and a colour's
-- own code (/product/lin1ivo) still opens the product on that colour.

create or replace function public.products_code() returns trigger
language plpgsql as $$
declare
  prefix text;
begin
  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id or new.code_base is null then
    perform pg_advisory_xact_lock(hashtext('product-code:' || coalesce(new.category_id::text, 'none')));
    select code_prefix into prefix from public.categories where id = new.category_id;
    new.code_number := coalesce((select max(code_number) from public.products where category_id is not distinct from new.category_id and id <> new.id), 0) + 1;
    new.code_base := coalesce(prefix, 'GEN') || new.code_number;
  end if;
  new.code := new.code_base || left(public.code_letters(new.colour), 3);
  new.slug := lower(new.code_base);
  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    insert into public.product_slug_redirects (old_slug, product_id) values (old.slug, new.id)
      on conflict (old_slug) do update set product_id = excluded.product_id;
  end if;
  -- A live address never redirects anywhere else.
  delete from public.product_slug_redirects where old_slug = new.slug;
  return new;
end $$;

-- Move every product onto its new address. Updating slug runs the trigger, which records the old one.
update public.products set slug = slug where slug is distinct from lower(code_base);

notify pgrst, 'reload schema';
