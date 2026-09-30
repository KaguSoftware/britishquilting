-- Stripe disputes (chargebacks): before this, a lost dispute silently left revenue on the
-- ledger with no offsetting entry, because the webhook never listened for dispute events.

alter table public.orders add column if not exists chargeback_pence int not null default 0 check (chargeback_pence >= 0);

create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  provider text not null default 'stripe',
  provider_ref text not null,
  charge_ref text,
  amount_pence int not null default 0,
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists order_disputes_provider_ref_idx on public.order_disputes (provider_ref);
create index if not exists order_disputes_order_idx on public.order_disputes (order_id);
alter table public.order_disputes enable row level security;
drop policy if exists "staff disputes read" on public.order_disputes;
create policy "staff disputes read" on public.order_disputes for select using (public.is_staff());

-- One row per balance transaction Stripe posts against a dispute. amount_pence is signed:
-- negative when funds are taken, positive when a won dispute reinstates them.
create table if not exists public.order_dispute_transactions (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.order_disputes on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  provider_ref text not null,
  amount_pence int not null,
  fee_pence int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists order_dispute_txn_ref_idx on public.order_dispute_transactions (provider_ref);
create index if not exists order_dispute_txn_order_idx on public.order_dispute_transactions (order_id, created_at);
alter table public.order_dispute_transactions enable row level security;
drop policy if exists "staff dispute txns read" on public.order_dispute_transactions;
create policy "staff dispute txns read" on public.order_dispute_transactions for select using (public.is_staff());

-- Whether an order has a dispute open right now (refunds are blocked while true).
create or replace function public.order_disputed(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_disputes
    where order_id = p_order_id and status in ('needs_response', 'under_review', 'warning_needs_response', 'warning_under_review')
  );
$$;
revoke execute on function public.order_disputed(uuid) from public, anon, authenticated;

-- Upserts a dispute by provider_ref, records any new balance-transaction lines (idempotent on
-- their own provider_ref, since Stripe resends the same events), and recalculates chargeback_pence
-- from the transactions actually posted rather than trusting a single point-in-time amount.
create or replace function public.record_dispute(
  p_order_id uuid,
  p_provider_ref text,
  p_charge_ref text,
  p_amount int,
  p_reason text,
  p_status text,
  p_evidence_due_by timestamptz,
  p_opened_at timestamptz,
  p_transactions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  did uuid;
  prev_status text;
  txn jsonb;
  net int;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  select id, status into did, prev_status from public.order_disputes where provider_ref = p_provider_ref;
  if did is null then
    insert into public.order_disputes (order_id, provider, provider_ref, charge_ref, amount_pence, reason, status, evidence_due_by, opened_at)
    values (p_order_id, 'stripe', p_provider_ref, p_charge_ref, p_amount, p_reason, p_status, p_evidence_due_by, coalesce(p_opened_at, now()))
    returning id into did;
  else
    update public.order_disputes set
      status = p_status,
      closed_at = case when p_status in ('won', 'lost', 'warning_closed') then coalesce(closed_at, now()) else closed_at end,
      updated_at = now()
    where id = did;
  end if;

  for txn in select * from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb))
  loop
    insert into public.order_dispute_transactions (dispute_id, order_id, provider_ref, amount_pence, fee_pence)
    values (did, p_order_id, txn->>'id', (txn->>'amount')::int, coalesce((txn->>'fee')::int, 0))
    on conflict (provider_ref) do nothing;
  end loop;

  select coalesce(sum(amount_pence), 0) into net from public.order_dispute_transactions where order_id = p_order_id;
  update public.orders set chargeback_pence = greatest(0, -net) where id = p_order_id;

  insert into public.order_events (order_id, kind, message, data, visible_to_customer)
  select p_order_id, 'dispute',
    case p_status
      when 'won' then 'Payment dispute resolved in your favour'
      when 'lost' then 'Payment dispute lost, funds taken back'
      else 'Payment disputed by the cardholder''s bank'
    end,
    jsonb_build_object('dispute_id', did, 'status', p_status, 'amount_pence', p_amount),
    false
  where prev_status is distinct from p_status;

  return jsonb_build_object('dispute_id', did, 'status_changed', prev_status is distinct from p_status, 'from', prev_status, 'to', p_status);
end $$;
revoke execute on function public.record_dispute(uuid, text, text, int, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
