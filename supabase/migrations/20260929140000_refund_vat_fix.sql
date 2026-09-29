-- Two fixes to record_refund from 20260928180000_order_lifecycle.sql:
--
-- 1. VAT rounding: the old formula rounded each refund's VAT share independently, so a sequence
--    of partial refunds could sum to a penny or two off the order's true vat_included_pence.
--    This allocates against the running refunded total instead, so the summed VAT across every
--    refund on an order always lands exactly on vat_included_pence once fully refunded.
-- 2. Refunds are blocked while a dispute is open (the bank already has the money in question),
--    and the "nothing left to refund" check now also accounts for money already taken by a
--    lost chargeback, so the same money can't be returned twice.

-- Given prior_refunded and prior_vat (what earlier refunds already recorded), the VAT share of
-- refunding p_amount now. The final refund (prior_refunded + p_amount >= total) always takes
-- whatever VAT is left, so the sequence can never drift from vat_included_pence.
create or replace function public.refund_vat_share(p_prior_refunded int, p_prior_vat int, p_total int, p_vat int, p_amount int)
returns int language sql immutable as $$
  select case
    when p_total <= 0 or p_vat <= 0 then 0
    when p_prior_refunded + p_amount >= p_total then greatest(0, p_vat - p_prior_vat)
    else greatest(0, round((p_prior_refunded + p_amount)::numeric * p_vat / p_total)::int - p_prior_vat)
  end;
$$;

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
  prior_vat int;
  vat_share int;
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
    if public.order_disputed(p_order_id) then
      raise exception 'payment_disputed: cannot refund while a dispute is open' using errcode = 'P0001';
    end if;
    if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
    if o.refunded_pence + coalesce(o.chargeback_pence, 0) + p_amount > o.total_pence then
      raise exception 'refund_exceeds_total: % left', o.total_pence - o.refunded_pence - coalesce(o.chargeback_pence, 0) using errcode = 'P0001';
    end if;

    select coalesce(sum(vat_pence), 0) into prior_vat from public.order_refunds where order_id = p_order_id;
    vat_share := public.refund_vat_share(o.refunded_pence, prior_vat, o.total_pence, o.vat_included_pence, p_amount);

    insert into public.order_refunds (order_id, amount_pence, vat_pence, reason, method, provider_ref, items, actor_id)
    values (p_order_id, p_amount, vat_share, nullif(trim(p_reason), ''), coalesce(p_method, 'manual'), p_provider_ref, p_items, p_actor)
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
