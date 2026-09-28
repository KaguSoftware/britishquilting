-- Order lifecycle backbone: legal status moves, cancellation, partial refunds and restocking.
-- Every mutating function is security definer and revoked from anon/authenticated:
-- only the service role (server actions, webhooks) may call them.

-- ─────────────────────────────────────────── columns
alter table public.orders
  add column if not exists refunded_pence int not null default 0 check (refunded_pence >= 0),
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists stock_returned boolean not null default false;

-- Cost snapshot per line (pence per metre or per unit), filled from products.cost_price_pence on insert.
alter table public.order_items add column if not exists cost_pence int;
alter table public.products add column if not exists cost_price_pence int check (cost_price_pence is null or cost_price_pence >= 0);

create or replace function public.order_items_cost_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cost_pence is null and new.product_id is not null and not new.is_swatch then
    select cost_price_pence into new.cost_pence from public.products where id = new.product_id;
  end if;
  return new;
end $$;
drop trigger if exists order_items_cost_snapshot on public.order_items;
create trigger order_items_cost_snapshot before insert on public.order_items
  for each row execute function public.order_items_cost_snapshot();

-- ─────────────────────────────────────────── refunds ledger
create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  amount_pence int not null check (amount_pence > 0),
  vat_pence int not null default 0,
  reason text,
  method text not null default 'manual',      -- stripe | paypal | manual
  provider_ref text,
  restocked boolean not null default false,
  items jsonb,                                -- [{order_item_id, qty}] qty in metres for cut lines, units otherwise
  actor_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_refunds_order_idx on public.order_refunds (order_id, created_at);
create unique index if not exists order_refunds_provider_ref_idx on public.order_refunds (provider_ref) where provider_ref is not null;
alter table public.order_refunds enable row level security;
drop policy if exists "staff refunds read" on public.order_refunds;
create policy "staff refunds read" on public.order_refunds for select using (public.is_staff());

-- ─────────────────────────────────────────── transition map
-- The single source of truth for forward status moves. src/lib/orders/transitions.ts mirrors
-- this list and its unit test parses the VALUES below, so keep one pair per line.
create table if not exists public.order_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  primary key (from_status, to_status)
);
alter table public.order_transitions enable row level security;
drop policy if exists "read transitions" on public.order_transitions;
create policy "read transitions" on public.order_transitions for select using (true);

delete from public.order_transitions;
insert into public.order_transitions (from_status, to_status) values
  ('pending', 'awaiting_payment'),
  ('pending', 'paid'),
  ('pending', 'cancelled'),
  ('awaiting_payment', 'paid'),
  ('awaiting_payment', 'cancelled'),
  ('paid', 'processing'),
  ('paid', 'shipped'),
  ('paid', 'ready_for_collection'),
  ('paid', 'cancelled'),
  ('paid', 'refunded'),
  ('processing', 'shipped'),
  ('processing', 'ready_for_collection'),
  ('processing', 'cancelled'),
  ('processing', 'refunded'),
  ('ready_for_collection', 'collected'),
  ('ready_for_collection', 'shipped'),
  ('ready_for_collection', 'cancelled'),
  ('ready_for_collection', 'refunded'),
  ('shipped', 'delivered'),
  ('shipped', 'refunded'),
  ('delivered', 'refunded'),
  ('collected', 'refunded'),
  ('cancelled', 'refunded');

-- Statuses a member of staff may step back out of (to the immediately previous status only).
create or replace function public.can_transition(p_from public.order_status, p_to public.order_status, p_previous public.order_status default null)
returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from public.order_transitions where from_status = p_from and to_status = p_to)
    or (
      p_previous is not null
      and p_to = p_previous
      and p_from in ('processing', 'shipped', 'ready_for_collection', 'collected', 'delivered')
      and p_previous in ('paid', 'processing', 'shipped', 'ready_for_collection')
    );
$$;

-- The status an order was in before its current one, from the last status event that moved it here.
create or replace function public.order_previous_status(p_order_id uuid)
returns public.order_status
language sql stable security definer set search_path = public as $$
  select (e.data->>'from')::public.order_status
  from public.order_events e
  join public.orders o on o.id = e.order_id
  where e.order_id = p_order_id
    and e.kind in ('status', 'shipped')
    and e.data ? 'from'
    and e.data->>'to' = o.status::text
  order by e.created_at desc
  limit 1;
$$;
revoke execute on function public.order_previous_status(uuid) from public, anon, authenticated;

-- Stock a line takes: metres for cut lines, otherwise one per unit or roll (matches stockUsage in src/lib/pricing.ts).
create or replace function public.order_line_stock_qty(p_mode public.sale_mode, p_length numeric, p_quantity int)
returns numeric
language sql immutable as $$
  select case when p_mode = 'metre' then coalesce(p_length, 0) * p_quantity else p_quantity::numeric end;
$$;

-- ─────────────────────────────────────────── stock in and out
create or replace function public.reserve_order_stock(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record; o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  for r in
    select p.id, p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
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
    select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
    from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null
    group by product_id
  ) x
  where p.id = x.product_id and p.track_stock;

  -- Invoice orders count their discount use here, atomically.
  update public.discount_codes d set uses = uses + 1
  where o.discount_code is not null and d.code = o.discount_code;
end $$;
revoke execute on function public.reserve_order_stock(uuid) from public, anon, authenticated;

-- Returns the order as json plus "transitioned": true only for the call that actually marked it paid,
-- so exactly one caller sends the confirmation email.
drop function if exists public.finalise_paid_order(uuid, public.payment_provider, text);
create function public.finalise_paid_order(p_order_id uuid, p_provider public.payment_provider, p_ref text)
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

  for r in
    select p.id, p.name, p.stock_qty, p.track_stock, x.qty
    from (
      select product_id, sum(public.order_line_stock_qty(sale_mode, length_m, quantity)) as qty
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
  return to_jsonb(o) || jsonb_build_object('transitioned', true);
end $$;
revoke execute on function public.finalise_paid_order(uuid, public.payment_provider, text) from public, anon, authenticated;

-- Whether stock (and a discount use) was ever taken for this order.
create or replace function public.order_stock_taken(o public.orders)
returns boolean language sql stable as $$
  select o.payment_provider = 'invoice' or o.paid_at is not null;
$$;

-- Puts stock back for the chosen lines. p_items: [{order_item_id, qty, restock?}] or null for every line in full;
-- lines with restock = false are skipped (a refunded cut length usually can't go back on the shelf).
-- qty is metres for cut lines, units or rolls otherwise. Never returns more than a line took,
-- counting earlier restocks, and is idempotent per p_key (e.g. 'cancel:<order>' or 'refund:<refund id>').
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
    select i.id, i.product_id, i.name, public.order_line_stock_qty(i.sale_mode, i.length_m, i.quantity) as took,
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
    update public.products set stock_qty = stock_qty + left_qty where id = r.product_id and track_stock;
    done := done || jsonb_build_object('order_item_id', r.id, 'product_id', r.product_id, 'name', r.name, 'qty', left_qty);
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

-- ─────────────────────────────────────────── cancel
create or replace function public.cancel_order(p_order_id uuid, p_restock boolean, p_actor uuid default null, p_reason text default null)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders; prev public.order_status; restocked jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  prev := o.status;
  if not public.can_transition(o.status, 'cancelled') then
    raise exception 'illegal_transition: % to cancelled', o.status using errcode = 'P0001';
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;

  if p_restock then
    restocked := public.restock_order_items(p_order_id, null, 'cancel:' || p_order_id::text, p_actor);
  end if;

  -- Give the discount use back if one was counted.
  if o.discount_code is not null and public.order_stock_taken(o) then
    update public.discount_codes set uses = greatest(0, uses - 1) where code = o.discount_code;
  end if;
  delete from public.discount_redemptions where order_id = p_order_id;

  insert into public.order_events (order_id, kind, message, data, actor_id)
  values (p_order_id, 'status', 'Order cancelled' || coalesce(': ' || nullif(trim(p_reason), ''), ''),
    jsonb_build_object('from', prev, 'to', 'cancelled', 'restock', coalesce(p_restock, false), 'reason', p_reason), p_actor);

  select * into o from public.orders where id = p_order_id;
  return o;
end $$;
revoke execute on function public.cancel_order(uuid, boolean, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────── refunds
-- Records a refund (full or partial). Returns the order as json plus "inserted" and "refund_id".
-- A repeat call with a provider_ref already on the ledger adds no money, but fills in the
-- reason and items and restocks if asked (the Stripe webhook may land before the admin action).
create or replace function public.record_refund(
  p_order_id uuid,
  p_amount int,
  p_items jsonb default null,
  p_restock boolean default false,
  p_provider_ref text default null,
  p_actor uuid default null,
  p_reason text default null,
  p_method text default 'manual'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  existing public.order_refunds;
  rid uuid;
  inserted boolean := false;
  full_now boolean;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;

  if p_provider_ref is not null then
    select * into existing from public.order_refunds where provider_ref = p_provider_ref;
  end if;

  if existing.id is not null then
    rid := existing.id;
    update public.order_refunds
      set reason = coalesce(reason, p_reason), items = coalesce(items, p_items), actor_id = coalesce(actor_id, p_actor)
      where id = rid;
  else
    if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
    if o.refunded_pence + p_amount > o.total_pence then
      raise exception 'refund_exceeds_total: % left', o.total_pence - o.refunded_pence using errcode = 'P0001';
    end if;
    insert into public.order_refunds (order_id, amount_pence, vat_pence, reason, method, provider_ref, items, actor_id)
    values (p_order_id, p_amount, case when o.total_pence > 0 then round(p_amount::numeric * o.vat_included_pence / o.total_pence)::int else 0 end,
      nullif(trim(p_reason), ''), coalesce(p_method, 'manual'), p_provider_ref, p_items, p_actor)
    returning id into rid;
    inserted := true;

    full_now := o.refunded_pence + p_amount >= o.total_pence;
    update public.orders set refunded_pence = refunded_pence + p_amount,
      refunded_at = case when full_now then now() else refunded_at end,
      status = case when full_now and public.can_transition(o.status, 'refunded') then 'refunded'::public.order_status else status end
    where id = p_order_id;

    insert into public.order_events (order_id, kind, message, data, actor_id)
    values (p_order_id, 'refund',
      case when full_now and o.refunded_pence = 0 then 'Refunded in full, ' else case when full_now then 'Final refund, ' else 'Partial refund, ' end end
        || '£' || to_char(p_amount / 100.0, 'FM999999990.00')
        || case when p_method = 'stripe' then ' through Stripe' when p_method = 'paypal' then ' through PayPal' else '' end,
      jsonb_build_object('refund_id', rid, 'amount_pence', p_amount, 'method', p_method, 'provider_ref', p_provider_ref, 'reason', p_reason,
        'from', o.status, 'to', case when full_now and public.can_transition(o.status, 'refunded') then 'refunded' else o.status::text end),
      p_actor);
  end if;

  if p_restock and not coalesce(existing.restocked, false) then
    perform public.restock_order_items(p_order_id, p_items, 'refund:' || rid::text, p_actor);
    update public.order_refunds set restocked = true where id = rid;
  end if;

  select * into o from public.orders where id = p_order_id;
  return to_jsonb(o) || jsonb_build_object('inserted', inserted, 'refund_id', rid);
end $$;
revoke execute on function public.record_refund(uuid, int, jsonb, boolean, text, uuid, text, text) from public, anon, authenticated;
