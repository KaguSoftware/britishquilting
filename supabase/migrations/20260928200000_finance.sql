-- Financial tracker (owner only): expenses book, fee settings, private receipts and a period summary.

-- ─────────────────────────────────────────── expenses
do $$ begin
  create type public.expense_category as enum (
    'stock', 'postage', 'packaging', 'rent', 'utilities', 'software', 'marketing',
    'equipment', 'travel', 'professional', 'bank_fees', 'wages', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default (now() at time zone 'Europe/London')::date,
  supplier text not null,
  category public.expense_category not null default 'other',
  amount_pence int not null check (amount_pence >= 0),          -- what was paid, including VAT
  vat_pence int not null default 0 check (vat_pence >= 0),     -- reclaimable VAT inside amount_pence
  note text,
  receipt_path text,                                           -- object in the private receipts bucket
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_vat_within_amount check (vat_pence <= amount_pence)
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);
alter table public.expenses enable row level security;
drop policy if exists "owner expenses" on public.expenses;
create policy "owner expenses" on public.expenses for all using (public.is_owner()) with check (public.is_owner());

-- ─────────────────────────────────────────── settings (single row)
create table if not exists public.finance_settings (
  id boolean primary key default true check (id),
  stripe_pct numeric(5,3) not null default 1.5 check (stripe_pct >= 0 and stripe_pct < 100),
  stripe_fixed_pence int not null default 20 check (stripe_fixed_pence >= 0),
  paypal_pct numeric(5,3) not null default 2.9 check (paypal_pct >= 0 and paypal_pct < 100),
  paypal_fixed_pence int not null default 30 check (paypal_fixed_pence >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate < 100),
  updated_at timestamptz not null default now()
);
insert into public.finance_settings (id) values (true) on conflict do nothing;
alter table public.finance_settings enable row level security;
drop policy if exists "owner finance settings" on public.finance_settings;
create policy "owner finance settings" on public.finance_settings for all using (public.is_owner()) with check (public.is_owner());

-- ─────────────────────────────────────────── receipts bucket (private)
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do update set public = false;
drop policy if exists "owner read receipts" on storage.objects;
drop policy if exists "owner write receipts" on storage.objects;
drop policy if exists "owner update receipts" on storage.objects;
drop policy if exists "owner delete receipts" on storage.objects;
create policy "owner read receipts" on storage.objects for select using (bucket_id = 'receipts' and public.is_owner());
create policy "owner write receipts" on storage.objects for insert with check (bucket_id = 'receipts' and public.is_owner());
create policy "owner update receipts" on storage.objects for update using (bucket_id = 'receipts' and public.is_owner());
create policy "owner delete receipts" on storage.objects for delete using (bucket_id = 'receipts' and public.is_owner());

-- ─────────────────────────────────────────── period summary
-- Headline sums for [p_from, p_to). Orders count in the period they were paid; refunds in the
-- period they were made; expenses by the day they were spent (Europe/London calendar days).
-- Fees and profit are worked out in src/lib/finance/calc.ts from these figures.
create or replace function public.finance_period_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable security definer set search_path = public as $$
  with o as (
    select * from public.orders where paid_at >= p_from and paid_at < p_to
  ), r as (
    select * from public.order_refunds where created_at >= p_from and created_at < p_to
  ), i as (
    select i.* from public.order_items i join o on o.id = i.order_id where not i.is_swatch and i.product_id is not null
  ), e as (
    select * from public.expenses
    where spent_on >= (p_from at time zone 'Europe/London')::date and spent_on < (p_to at time zone 'Europe/London')::date
  )
  select jsonb_build_object(
    'orders', (select count(*) from o),
    'gross_pence', (select coalesce(sum(total_pence), 0) from o),
    'vat_pence', (select coalesce(sum(vat_included_pence), 0) from o),
    'shipping_pence', (select coalesce(sum(shipping_pence), 0) from o),
    'discount_pence', (select coalesce(sum(discount_pence), 0) from o),
    'refunds_pence', (select coalesce(sum(amount_pence), 0) from r),
    'refund_vat_pence', (select coalesce(sum(vat_pence), 0) from r),
    'cogs_pence', (select coalesce(round(sum(cost_pence * public.order_line_stock_qty(sale_mode, length_m, quantity))), 0) from i where cost_pence is not null),
    'cost_missing', (select count(*) from i where cost_pence is null),
    'expenses_pence', (select coalesce(sum(amount_pence), 0) from e),
    'expenses_vat_pence', (select coalesce(sum(vat_pence), 0) from e)
  );
$$;
revoke execute on function public.finance_period_summary(timestamptz, timestamptz) from public, anon, authenticated;
