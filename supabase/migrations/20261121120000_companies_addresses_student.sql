-- Companies as their own records, linked both ways with customers (hand-added and website accounts).
-- Every customer and company has one address plus an optional second address.
-- Website accounts gain a student flag, a birthday and a one-off welcome step; staff notes for accounts live
-- in their own staff-only table so customers can never read them through "own profile" access.

-- ───────────────────────── Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email citext,
  phone text,
  vat_number text,
  company_number text,
  line1 text, line2 text, city text, county text, postcode text,
  alt_line1 text, alt_line2 text, alt_city text, alt_county text, alt_postcode text,
  note text,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_name_idx on public.companies (lower(name));
drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();
alter table public.companies enable row level security;
drop policy if exists "staff companies" on public.companies;
create policy "staff companies" on public.companies for all using (public.is_staff()) with check (public.is_staff());

-- ───────────────────────── Hand-added customers
alter table public.manual_customers add column if not exists company_id uuid references public.companies on delete set null;
alter table public.manual_customers add column if not exists is_student boolean not null default false;
alter table public.manual_customers add column if not exists alt_line1 text;
alter table public.manual_customers add column if not exists alt_line2 text;
alter table public.manual_customers add column if not exists alt_city text;
alter table public.manual_customers add column if not exists alt_county text;
alter table public.manual_customers add column if not exists alt_postcode text;
create index if not exists manual_customers_company_idx on public.manual_customers (company_id);

-- ───────────────────────── Website accounts
alter table public.profiles add column if not exists company_id uuid references public.companies on delete set null;
alter table public.profiles add column if not exists is_student boolean;           -- null: not answered yet
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists dob_changed_at timestamptz;    -- set when an existing birthday is changed
alter table public.profiles add column if not exists onboarded_at timestamptz;      -- welcome step answered or skipped
alter table public.profiles add column if not exists birthday_emailed_year int;     -- last year the birthday email went out
create index if not exists profiles_company_idx on public.profiles (company_id);
create index if not exists profiles_dob_idx on public.profiles (extract(month from dob), extract(day from dob)) where dob is not null;

-- Staff notes about website accounts
create table if not exists public.account_notes (
  profile_id uuid primary key references public.profiles on delete cascade,
  note text not null default '',
  updated_by uuid references public.profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.account_notes enable row level security;
drop policy if exists "staff account notes" on public.account_notes;
create policy "staff account notes" on public.account_notes for all using (public.is_staff()) with check (public.is_staff());

-- ───────────────────────── Keep the plain-text company names in step with the linked company
-- (search, the admin views and invoice snapshots all read the text columns).
create or replace function public.manual_customers_company_name() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.company_id is not null and (tg_op = 'INSERT' or new.company_id is distinct from old.company_id or new.company is null) then
    select name into new.company from public.companies where id = new.company_id;
  end if;
  return new;
end $$;
drop trigger if exists manual_customers_company_name on public.manual_customers;
create trigger manual_customers_company_name before insert or update on public.manual_customers
  for each row execute function public.manual_customers_company_name();

create or replace function public.profiles_company_name() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.company_id is not null and (tg_op = 'INSERT' or new.company_id is distinct from old.company_id) then
    select name into new.company_name from public.companies where id = new.company_id;
  end if;
  return new;
end $$;
-- Named to fire after profiles_guard (same-event triggers run in name order), so a reverted company_id is honoured.
drop trigger if exists profiles_sync_company_name on public.profiles;
create trigger profiles_sync_company_name before insert or update on public.profiles
  for each row execute function public.profiles_company_name();

create or replace function public.companies_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.manual_customers set company = new.name where company_id = new.id;
    update public.profiles set company_name = new.name where company_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists companies_rename on public.companies;
create trigger companies_rename after update on public.companies for each row execute function public.companies_rename();

-- ───────────────────────── Profile guard: customers may answer the welcome questions, nothing staff-owned
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Changing a birthday that was already set restarts the wait before a birthday discount applies.
  if old.dob is not null and new.dob is distinct from old.dob then
    new.dob_changed_at := now();
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_staff() then
    new.role := old.role;
    new.trade_status := old.trade_status;
    new.company_id := old.company_id;
    new.birthday_emailed_year := old.birthday_emailed_year;
    new.dob_changed_at := case when old.dob is not null and new.dob is distinct from old.dob then now() else old.dob_changed_at end;
  end if;
  if not public.is_owner() and new.role in ('staff','owner') and old.role is distinct from new.role then
    raise exception 'Only the owner can grant staff roles';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
