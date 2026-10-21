-- Every product's web address is now its code: /product/lin3 (or /product/lin2cha for a single-colour product).
-- The old addresses (/product/blackout-lining) keep working: they are remembered here and redirect.
-- A colour's own code (/product/lin1ivo) opens the product on that colour; the site handles that part.

create table if not exists public.product_slug_redirects (
  old_slug text primary key,
  product_id uuid not null references public.products on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists product_slug_redirects_product_idx on public.product_slug_redirects (product_id);
alter table public.product_slug_redirects enable row level security;
drop policy if exists "public slug redirects" on public.product_slug_redirects;
create policy "public slug redirects" on public.product_slug_redirects for select using (true);
drop policy if exists "staff slug redirects" on public.product_slug_redirects;
create policy "staff slug redirects" on public.product_slug_redirects for all using (public.is_staff()) with check (public.is_staff());
grant select on public.product_slug_redirects to anon, authenticated;

-- The code is public: shown on the product page and searchable from the header.
grant select (code, code_base) on public.products to anon, authenticated;
create or replace view public.products_public with (security_invoker = true) as
  select id, slug, name, subtitle, description, category_id, sale_mode, price_pence, compare_at_pence,
         min_length_m, length_step_m, max_length_m, roll_length_m, weight_g_per_unit,
         swatch_enabled, swatch_price_pence,
         case when track_stock then stock_qty > 0 else true end as in_stock,
         case when track_stock and stock_qty <= low_stock_threshold and stock_qty > 0 then true else false end as low_stock,
         colour, colour_hex, composition, width_cm, weight_gsm, care, tags, is_featured, sort_order,
         seo_title, seo_description, rating_avg, rating_count, created_at,
         code, code_base
  from public.products where is_active;

-- Same as before, plus: the slug follows the code, and the old slug is kept as a redirect.
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
  new.slug := lower(new.code);
  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    insert into public.product_slug_redirects (old_slug, product_id) values (old.slug, new.id)
      on conflict (old_slug) do update set product_id = excluded.product_id;
  end if;
  -- A live address never redirects anywhere else.
  delete from public.product_slug_redirects where old_slug = new.slug;
  return new;
end $$;

drop trigger if exists products_code on public.products;
create trigger products_code before insert or update of category_id, colour, code_base, slug on public.products
  for each row execute function public.products_code();

-- Move every existing product onto its code. Updating slug runs the trigger, which records the old one.
update public.products set slug = slug where slug is distinct from lower(code);

notify pgrst, 'reload schema';
