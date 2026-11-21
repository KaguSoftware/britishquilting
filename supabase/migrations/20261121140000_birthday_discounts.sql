-- Birthday discount: website accounts with a birthday get an email on the day and an automatic discount at
-- checkout (no code) for a number of days set by the owner. One birthday order per year.

alter table public.store_settings add column if not exists birthday_enabled boolean not null default false;
alter table public.store_settings add column if not exists birthday_kind public.discount_kind not null default 'percent';
alter table public.store_settings add column if not exists birthday_value int not null default 10 check (birthday_value >= 0);
alter table public.store_settings add column if not exists birthday_days int not null default 14 check (birthday_days between 1 and 60);
alter table public.store_settings add column if not exists birthday_min_subtotal_pence int not null default 0 check (birthday_min_subtotal_pence >= 0);
alter table public.store_settings drop constraint if exists store_settings_birthday_kind_check;
alter table public.store_settings add constraint store_settings_birthday_kind_check check (birthday_kind in ('percent', 'fixed'));

-- The birthday year an order used its birthday discount for.
alter table public.orders add column if not exists birthday_year int;
create index if not exists orders_birthday_idx on public.orders (user_id, birthday_year) where birthday_year is not null;

notify pgrst, 'reload schema';
