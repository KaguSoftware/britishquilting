-- Freezes the money facts that must never move after the fact:
-- the VAT rate an order was placed at, and the payment fee actually charged when it was paid.
-- Before this, both were recomputed from today's finance_settings every time the ledger ran,
-- so editing a rate silently rewrote every past period's VAT and profit figures.

alter table public.orders
  add column if not exists vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate < 100),
  add column if not exists fee_pct numeric(5,3),
  add column if not exists fee_fixed_pence int,
  add column if not exists fee_pence int check (fee_pence is null or fee_pence >= 0);

-- Every order placed before this migration was priced with the hardcoded 20% in src/lib/pricing.ts,
-- so the column default (20) is already the true historical rate: no backfill needed for vat_rate.

create or replace function public.orders_money_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.finance_settings;
begin
  -- VAT rate: the app always supplies this at insert time, but fall back to the live
  -- setting for any other insert path (e.g. a script, or a future admin tool).
  if tg_op = 'INSERT' and new.vat_rate is null then
    select vat_rate into new.vat_rate from public.finance_settings limit 1;
    new.vat_rate := coalesce(new.vat_rate, 20);
  end if;

  -- Fee: frozen the first time an order is marked paid, from the settings in force at that moment.
  -- Once fee_pence is set it is never recalculated, so editing fee rates later never touches it.
  if new.paid_at is not null and new.fee_pence is null then
    select * into s from public.finance_settings limit 1;
    if new.payment_provider = 'stripe' then
      new.fee_pct := coalesce(s.stripe_pct, 1.5);
      new.fee_fixed_pence := coalesce(s.stripe_fixed_pence, 20);
    elsif new.payment_provider = 'paypal' then
      new.fee_pct := coalesce(s.paypal_pct, 2.9);
      new.fee_fixed_pence := coalesce(s.paypal_fixed_pence, 30);
    else
      new.fee_pct := 0;
      new.fee_fixed_pence := 0;
    end if;
    new.fee_pence := round(greatest(new.total_pence, 0) * new.fee_pct / 100)::int + new.fee_fixed_pence;
  end if;
  return new;
end $$;

drop trigger if exists orders_money_snapshot on public.orders;
create trigger orders_money_snapshot before insert or update of paid_at, payment_provider on public.orders
  for each row execute function public.orders_money_snapshot();

-- Backfill fee_pence once for orders already paid, at today's settings (the best information available;
-- there is no record of what the rates were when each of these was actually charged).
do $$
declare s public.finance_settings;
begin
  select * into s from public.finance_settings limit 1;
  update public.orders set
    fee_pct = case payment_provider when 'stripe' then coalesce(s.stripe_pct, 1.5) when 'paypal' then coalesce(s.paypal_pct, 2.9) else 0 end,
    fee_fixed_pence = case payment_provider when 'stripe' then coalesce(s.stripe_fixed_pence, 20) when 'paypal' then coalesce(s.paypal_fixed_pence, 30) else 0 end
  where paid_at is not null and fee_pence is null;
  update public.orders set
    fee_pence = round(greatest(total_pence, 0) * fee_pct / 100)::int + fee_fixed_pence
  where paid_at is not null and fee_pence is null and fee_pct is not null;
end $$;
