-- Atomic stock handling. Both invoice orders and paid orders lock the affected
-- product rows (in id order, to avoid deadlocks) before decrementing, so two
-- concurrent orders can never read the same stock level.

-- Invoice orders: all or nothing. Raises 'insufficient_stock' if any line is short.
create or replace function public.reserve_order_stock(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select p.id, p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(case when sale_mode = 'unit' then quantity else coalesce(length_m, 0) * quantity end) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null
      group by product_id
    ) x
    join public.products p on p.id = x.product_id
    order by p.id
    for update of p
  loop
    if r.track_stock and r.stock_qty < r.qty then
      raise exception 'insufficient_stock: %', r.name using errcode = 'P0001';
    end if;
  end loop;

  update public.products p set stock_qty = p.stock_qty - x.qty
  from (
    select product_id, sum(case when sale_mode = 'unit' then quantity else coalesce(length_m, 0) * quantity end) as qty
    from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null
    group by product_id
  ) x
  where p.id = x.product_id and p.track_stock;
end $$;
revoke execute on function public.reserve_order_stock(uuid) from public, anon, authenticated;

-- Paid orders: the money has already been taken, so we never fail here. Stock floors
-- at zero and any shortfall is logged as a staff-only 'stock_short' event.
create or replace function public.finalise_paid_order(p_order_id uuid, p_provider public.payment_provider, p_ref text)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  r record;
  short jsonb := '[]'::jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  -- idempotent: webhooks may retry
  if o.status not in ('pending', 'awaiting_payment') then return o; end if;

  for r in
    select p.id, p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(case when sale_mode = 'unit' then quantity else coalesce(length_m, 0) * quantity end) as qty
      from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null
      group by product_id
    ) x
    join public.products p on p.id = x.product_id
    order by p.id
    for update of p
  loop
    if r.track_stock then
      if r.stock_qty < r.qty then
        short := short || jsonb_build_object('product_id', r.id, 'name', r.name, 'wanted', r.qty, 'available', r.stock_qty);
      end if;
      update public.products set stock_qty = greatest(0, stock_qty - r.qty) where id = r.id;
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
  return o;
end $$;
revoke execute on function public.finalise_paid_order(uuid, public.payment_provider, text) from public, anon, authenticated;
