-- Product codes, e.g. LIN3RED: the category's three letters (LIN for Linings), the product's number within
-- that category (1, 2, 3... in the order they were added) and the first three letters of the colour.
--   categories.code_prefix      LIN
--   products.code_number        3
--   products.code_base          LIN3      (the product, whatever the colour)
--   products.code               LIN3RED   (single-colour products; LIN3 when there is no colour)
--   product_variants.code       LIN3RED   (each colour of a product sold in colours)
-- The database hands them out, so every product gets one however it is created. Codes already printed on
-- invoices are copies, so they never change after the fact.

alter table public.categories add column if not exists code_prefix text unique;
alter table public.products
  add column if not exists code_number int,
  add column if not exists code_base text unique,
  add column if not exists code text unique;
alter table public.product_variants add column if not exists code text unique;

-- Letters only, upper case: "Fabrics & Ties" -> FABRICSTIES.
create or replace function public.code_letters(t text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z]', '', 'g'))
$$;

-- Three letters, the first three where possible. When they are taken, keep the first two and walk along the
-- word (LINen -> LIE, LIN... ), then fall back to A, B, C. `taken` says whether a candidate is in use.
create or replace function public.pick_letters(word text, taken text[]) returns text
language plpgsql immutable as $$
declare
  letters text := public.code_letters(word);
  cand text;
  i int := 4;
  k int := 0;
begin
  if length(letters) < 3 then letters := rpad(letters, 3, 'X'); end if;
  cand := left(letters, 3);
  while cand = any(taken) loop
    if i <= length(letters) then
      cand := left(letters, 2) || substr(letters, i, 1);
      i := i + 1;
    else
      k := k + 1;
      cand := left(letters, 2) || chr(64 + ((k - 1) % 26) + 1) || case when k > 26 then chr(64 + ((k - 1) / 26)) else '' end;
    end if;
  end loop;
  return cand;
end $$;

-- ─────────────────────────────────────────── categories
create or replace function public.categories_code_prefix() returns trigger
language plpgsql as $$
begin
  if new.code_prefix is null then
    new.code_prefix := public.pick_letters(new.name, array(select code_prefix from public.categories where code_prefix is not null and id <> new.id));
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────── products
-- A product gets its number when it is added, and a new one if it moves to another category.
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
  return new;
end $$;

-- ─────────────────────────────────────────── colours
create or replace function public.variant_code(p_product uuid, p_name text, p_variant uuid) returns text
language sql stable as $$
  select p.code_base || public.pick_letters(p_name, array(
    select substr(v.code, length(p.code_base) + 1) from public.product_variants v where v.product_id = p_product and v.id <> p_variant and v.code is not null))
  from public.products p where p.id = p_product
$$;

create or replace function public.product_variants_code() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.code is null then
    new.code := public.variant_code(new.product_id, new.name, new.id);
  end if;
  return new;
end $$;

-- When a product moves category its colours follow the new code.
create or replace function public.products_recode_variants() returns trigger
language plpgsql as $$
begin
  if new.code_base is distinct from old.code_base then
    update public.product_variants set code = null where product_id = new.id;
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────── codes for everything already there
do $$
declare
  c record;
  v record;
begin
  for c in select id, name from public.categories where code_prefix is null order by sort_order, created_at loop
    update public.categories
      set code_prefix = public.pick_letters(c.name, array(select code_prefix from public.categories where code_prefix is not null))
      where id = c.id;
  end loop;

  update public.products p
    set code_number = r.n
    from (select id, row_number() over (partition by category_id order by created_at, name) as n from public.products where code_base is null) r
    where p.id = r.id;
  update public.products p
    set code_base = coalesce((select cat.code_prefix from public.categories cat where cat.id = p.category_id), 'GEN') || p.code_number
    where p.code_base is null;
  update public.products set code = code_base || left(public.code_letters(colour), 3) where code is null;

  for v in select id, product_id, name from public.product_variants where code is null order by product_id, sort_order, created_at loop
    update public.product_variants set code = public.variant_code(v.product_id, v.name, v.id) where id = v.id;
  end loop;
end $$;

-- Only now that every product has its number: one number per category (uncategorised products count as one group).
create unique index if not exists products_category_code_number_key on public.products (category_id, code_number) nulls not distinct;

drop trigger if exists categories_code_prefix on public.categories;
create trigger categories_code_prefix before insert or update of name, code_prefix on public.categories
  for each row execute function public.categories_code_prefix();
drop trigger if exists products_code on public.products;
create trigger products_code before insert or update of category_id, colour, code_base on public.products
  for each row execute function public.products_code();
drop trigger if exists products_recode_variants on public.products;
create trigger products_recode_variants after update of category_id, code_base on public.products
  for each row execute function public.products_recode_variants();
drop trigger if exists product_variants_code on public.product_variants;
create trigger product_variants_code before insert or update of name, code on public.product_variants
  for each row execute function public.product_variants_code();

-- Finding a product by code or name as you type on an invoice.
create index if not exists products_code_lower_idx on public.products (lower(code));
create index if not exists product_variants_code_lower_idx on public.product_variants (lower(code));

notify pgrst, 'reload schema';
