-- Colour variants: one product (e.g. "Cotton Sateen Lining") offered in several colours,
-- each with its own photos and its own stock. A product without variants works exactly as before.
-- When a product has variants, products.stock_qty is kept as the sum of its active variants,
-- so the shop listing, low stock checks and the admin table keep reading one number.

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  name text not null,
  colour_hex text,
  -- metres for metre/roll products, units for unit products (same as products.stock_qty)
  stock_qty numeric(12,2) not null default 0 check (stock_qty >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create trigger product_variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

alter table public.product_variants enable row level security;
create policy "public variants" on public.product_variants for select using (
  is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "staff variants" on public.product_variants for all using (public.is_staff()) with check (public.is_staff());
grant select on public.product_variants to anon, authenticated;

-- Photos can belong to one colour; null means the photo is shared by every colour.
alter table public.product_images add column variant_id uuid references public.product_variants on delete cascade;
create index product_images_variant_idx on public.product_images (variant_id) where variant_id is not null;

-- Order lines remember the colour chosen, even if the variant is later deleted.
alter table public.order_items
  add column variant_id uuid references public.product_variants on delete set null,
  add column variant_name text;

-- Back in stock alerts can be for one colour.
alter table public.stock_alerts add column variant_id uuid references public.product_variants on delete cascade;
alter table public.stock_alerts drop constraint if exists stock_alerts_product_id_email_key;
create unique index stock_alerts_target_email_key on public.stock_alerts (product_id, variant_id, email) nulls not distinct;

-- ─────────────────────────────────────────── keep the product total in step
create or replace function public.sync_product_stock_from_variants()
returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  if exists (select 1 from public.product_variants where product_id = pid) then
    update public.products
    set stock_qty = (select coalesce(sum(stock_qty), 0) from public.product_variants where product_id = pid and is_active)
    where id = pid;
  end if;
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    update public.products
    set stock_qty = (select coalesce(sum(stock_qty), 0) from public.product_variants where product_id = old.product_id and is_active)
    where id = old.product_id;
  end if;
  return null;
end $$;
create trigger product_variants_sync_stock after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock_from_variants();

-- ─────────────────────────────────────────── stock in and out, variant aware
-- Lines with a variant take stock from that variant (the trigger above then refreshes the
-- product total); lines without one take it from the product, as before. Rows are locked
-- products first, then variants, each in id order, so concurrent orders can't deadlock.

create or replace function public.reserve_order_stock(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record; o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;

  perform 1 from public.products p
  where p.id in (select product_id from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null)
  order by p.id for update;

  for r in
    select p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null and variant_id is null
      group by product_id
    ) x
    join public.products p on p.id = x.product_id
  loop
    if r.track_stock and r.stock_qty < r.qty then
      raise exception 'insufficient_stock: %', r.name using errcode = 'P0001';
    end if;
  end loop;

  for r in
    select p.name, v.name as variant, v.stock_qty, p.track_stock, x.qty
    from (
      select variant_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and variant_id is not null
      group by variant_id
    ) x
    join public.product_variants v on v.id = x.variant_id
    join public.products p on p.id = v.product_id
    order by v.id
    for update of v
  loop
    if r.track_stock and r.stock_qty < r.qty then
      raise exception 'insufficient_stock: % (%)', r.name, r.variant using errcode = 'P0001';
    end if;
  end loop;

  update public.products p set stock_qty = p.stock_qty - x.qty
  from (
    select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
    from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null and variant_id is null
    group by product_id
  ) x
  where p.id = x.product_id and p.track_stock;

  update public.product_variants v set stock_qty = v.stock_qty - x.qty
  from (
    select variant_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
    from public.order_items where order_id = p_order_id and not is_swatch and variant_id is not null
    group by variant_id
  ) x, public.products p
  where v.id = x.variant_id and p.id = v.product_id and p.track_stock;

  -- Invoice orders count their discount use here, atomically.
  update public.discount_codes d set uses = uses + 1
  where o.discount_code is not null and d.code = o.discount_code;
end $$;
revoke execute on function public.reserve_order_stock(uuid) from public, anon, authenticated;

create or replace function public.finalise_paid_order(p_order_id uuid, p_provider public.payment_provider, p_ref text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  r record;
  short jsonb := '[]'::jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  if o.status not in ('pending', 'awaiting_payment') then
    return to_jsonb(o) || jsonb_build_object('transitioned', false);
  end if;

  perform 1 from public.products p
  where p.id in (select product_id from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null)
  order by p.id for update;

  for r in
    select p.id, p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null and variant_id is null
      group by product_id
    ) x
    join public.products p on p.id = x.product_id
  loop
    if r.track_stock then
      if r.stock_qty < r.qty then
        short := short || jsonb_build_object('product_id', r.id, 'name', r.name, 'wanted', r.qty, 'available', r.stock_qty);
      end if;
      update public.products set stock_qty = greatest(0, stock_qty - r.qty) where id = r.id;
    end if;
  end loop;

  for r in
    select p.id, p.name, v.id as variant_id, v.name as variant, v.stock_qty, p.track_stock, x.qty
    from (
      select variant_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and variant_id is not null
      group by variant_id
    ) x
    join public.product_variants v on v.id = x.variant_id
    join public.products p on p.id = v.product_id
    order by v.id
    for update of v
  loop
    if r.track_stock then
      if r.stock_qty < r.qty then
        short := short || jsonb_build_object('product_id', r.id, 'variant_id', r.variant_id, 'name', r.name || ', ' || r.variant, 'wanted', r.qty, 'available', r.stock_qty);
      end if;
      update public.product_variants set stock_qty = greatest(0, stock_qty - r.qty) where id = r.variant_id;
    end if;
  end loop;

  update public.discount_codes d set uses = uses + 1
  where o.discount_code is not null and d.code = o.discount_code;

  update public.orders set status = 'paid', payment_provider = p_provider, payment_ref = p_ref, paid_at = now()
  where id = p_order_id returning * into o;

  insert into public.order_events (order_id, kind, message) values (p_order_id, 'paid', 'Payment received');
  if jsonb_array_length(short) > 0 then
    insert into public.order_events (order_id, kind, message, data, visible_to_customer)
    values (p_order_id, 'stock_short', 'Paid order exceeded available stock, check before packing', jsonb_build_object('items', short), false);
  end if;
  return to_jsonb(o) || jsonb_build_object('transitioned', true);
end $$;
revoke execute on function public.finalise_paid_order(uuid, public.payment_provider, text) from public, anon, authenticated;

create or replace function public.restock_order_items(p_order_id uuid, p_items jsonb, p_key text, p_actor uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  r record;
  done jsonb := '[]'::jsonb;
  want numeric;
  left_qty numeric;
  remaining numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  if exists (select 1 from public.order_events where order_id = p_order_id and kind = 'restocked' and data->>'key' = p_key) then
    return null;
  end if;
  if not public.order_stock_taken(o) then return '[]'::jsonb; end if;

  for r in
    select i.id, i.product_id, i.variant_id, i.name, public.order_line_stock_qty(i.sale_mode, i.length_m, i.quantity) as took,
      coalesce((
        select sum((x->>'qty')::numeric)
        from public.order_events e, jsonb_array_elements(e.data->'items') x
        where e.order_id = p_order_id and e.kind = 'restocked' and x->>'order_item_id' = i.id::text
      ), 0) as already
    from public.order_items i
    join public.products p on p.id = i.product_id
    where i.order_id = p_order_id and not i.is_swatch
    order by i.product_id
    for update of p
  loop
    if p_items is null then
      want := r.took;
    else
      select (x->>'qty')::numeric into want from jsonb_array_elements(p_items) x
        where x->>'order_item_id' = r.id::text and coalesce((x->>'restock')::boolean, true) limit 1;
      if want is null then continue; end if;
    end if;
    left_qty := least(greatest(want, 0), r.took - r.already);
    if left_qty <= 0 then continue; end if;
    if r.variant_id is not null and exists (select 1 from public.product_variants where id = r.variant_id) then
      update public.product_variants v set stock_qty = v.stock_qty + left_qty
      from public.products p where v.id = r.variant_id and p.id = v.product_id and p.track_stock;
    else
      update public.products set stock_qty = stock_qty + left_qty where id = r.product_id and track_stock;
    end if;
    done := done || jsonb_build_object('order_item_id', r.id, 'product_id', r.product_id, 'variant_id', r.variant_id, 'name', r.name, 'qty', left_qty);
  end loop;

  if jsonb_array_length(done) > 0 then
    insert into public.order_events (order_id, kind, message, data, actor_id, visible_to_customer)
    values (p_order_id, 'restocked', 'Returned to stock: ' || (select string_agg((x->>'name') || ' ' || (x->>'qty'), ', ') from jsonb_array_elements(done) x),
      jsonb_build_object('key', p_key, 'items', done), p_actor, false);
  end if;

  -- Flag the order once every line is fully back.
  select coalesce(sum(greatest(public.order_line_stock_qty(i.sale_mode, i.length_m, i.quantity) - coalesce((
      select sum((x->>'qty')::numeric) from public.order_events e, jsonb_array_elements(e.data->'items') x
      where e.order_id = p_order_id and e.kind = 'restocked' and x->>'order_item_id' = i.id::text), 0), 0)), 0)
    into remaining
  from public.order_items i where i.order_id = p_order_id and not i.is_swatch and i.product_id is not null;
  if remaining <= 0 then update public.orders set stock_returned = true where id = p_order_id; end if;
  return done;
end $$;
revoke execute on function public.restock_order_items(uuid, jsonb, text, uuid) from public, anon, authenticated;
