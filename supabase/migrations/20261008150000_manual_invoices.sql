-- Customers added by hand on the Customers page (phone orders, trade, shows, no website account)
-- and the invoices written by hand. Order invoices still come straight from public.orders.

-- ─────────────────────────────────────────── customers
create table if not exists public.manual_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  email text,
  phone text,
  line1 text,
  line2 text,
  city text,
  county text,
  postcode text,
  note text,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists manual_customers_name_idx on public.manual_customers (lower(full_name));
drop trigger if exists manual_customers_touch on public.manual_customers;
create trigger manual_customers_touch before update on public.manual_customers for each row execute function public.touch_updated_at();
alter table public.manual_customers enable row level security;
drop policy if exists "staff manual customers" on public.manual_customers;
create policy "staff manual customers" on public.manual_customers for all using (public.is_staff()) with check (public.is_staff());

-- ─────────────────────────────────────────── invoices
-- Shown as INV-M1001 so the numbers never clash with order invoices (INV-10001 and up).
create sequence if not exists public.invoice_number_seq start 1001;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number int unique not null default nextval('public.invoice_number_seq'),
  customer_id uuid references public.manual_customers on delete set null,
  bill_to jsonb not null,                       -- the customer as they were when the invoice was saved
  items jsonb not null default '[]'::jsonb,     -- [{ description, quantity, unit_price_pence }]
  total_pence int not null check (total_pence >= 0),
  vat_included_pence int not null default 0 check (vat_included_pence >= 0),
  issued_on date not null default (now() at time zone 'Europe/London')::date,
  due_on date,
  note text,
  paid_at timestamptz,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_issued_idx on public.invoices (issued_on desc, number desc);
create index if not exists invoices_customer_idx on public.invoices (customer_id);
drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();
alter table public.invoices enable row level security;
drop policy if exists "staff invoices" on public.invoices;
create policy "staff invoices" on public.invoices for all using (public.is_staff()) with check (public.is_staff());
