-- A customer ID (CID-1001) for every customer: website accounts, guests who checked out without an account, and
-- customers added by hand. One counter for all three, so a CID is never shared. Customers added by hand keep the
-- numbers they already have. A guest who later signs up with the same email keeps their CID on the new account.
-- Also the two lists behind the "All" views on the Customers and Invoices pages.

-- ─────────────────────────────────────────── one counter
create sequence if not exists public.customer_cid_seq start 1001;
select setval('public.customer_cid_seq', greatest(coalesce((select max(number) from public.manual_customers), 1000), 1000));
alter table public.manual_customers alter column number set default nextval('public.customer_cid_seq');

-- ─────────────────────────────────────────── accounts
alter table public.profiles add column if not exists cid int unique;
do $$
declare r record;
begin
  for r in select id from public.profiles where cid is null order by created_at, id loop
    update public.profiles set cid = nextval('public.customer_cid_seq') where id = r.id;
  end loop;
end $$;
alter table public.profiles alter column cid set default nextval('public.customer_cid_seq');

-- ─────────────────────────────────────────── guests
create table if not exists public.guest_customers (
  email extensions.citext primary key,
  cid int unique not null default nextval('public.customer_cid_seq'),
  created_at timestamptz not null default now()
);
alter table public.guest_customers enable row level security;
drop policy if exists "staff guest customers" on public.guest_customers;
create policy "staff guest customers" on public.guest_customers for all using (public.is_staff()) with check (public.is_staff());

-- Guests from orders already placed, oldest first. Pending orders are abandoned checkouts and don't count.
insert into public.guest_customers (email, created_at)
select o.email, min(o.created_at)
from public.orders o
where o.user_id is null and o.status <> 'pending'
  and not exists (select 1 from public.profiles p where p.email = o.email)
group by o.email
order by min(o.created_at)
on conflict (email) do nothing;

-- A guest gets a CID with their first real order.
create or replace function public.orders_guest_cid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.status <> 'pending' and not exists (select 1 from public.profiles where email = new.email) then
    insert into public.guest_customers (email) values (new.email) on conflict (email) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists orders_guest_cid on public.orders;
create trigger orders_guest_cid after insert or update of status, user_id on public.orders
  for each row execute function public.orders_guest_cid();

-- Signing up with a guest's email: the account takes over the guest's CID.
create or replace function public.profiles_take_guest_cid() returns trigger
language plpgsql security definer set search_path = public as $$
declare guest_cid int;
begin
  delete from public.guest_customers where email = new.email returning cid into guest_cid;
  if guest_cid is not null then new.cid := guest_cid; end if;
  return new;
end $$;
drop trigger if exists profiles_take_guest_cid on public.profiles;
create trigger profiles_take_guest_cid before insert on public.profiles
  for each row execute function public.profiles_take_guest_cid();

-- Customers can edit their own profile; the CID is not theirs to change.
create or replace function public.profiles_keep_cid() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then new.cid := old.cid; end if;
  return new;
end $$;
drop trigger if exists profiles_keep_cid on public.profiles;
create trigger profiles_keep_cid before update of cid on public.profiles
  for each row execute function public.profiles_keep_cid();

-- ─────────────────────────────────────────── the "All" lists (back office only)
create or replace view public.admin_customers with (security_invoker = true) as
  select 'manual'::text as kind, m.id as ref_id, m.number as cid, m.full_name as name, m.company, m.email::text as email, m.phone,
         null::text as role, m.created_at
  from public.manual_customers m
  union all
  select 'account', p.id, p.cid, coalesce(nullif(p.full_name, ''), p.email::text), p.company_name, p.email::text, p.phone,
         p.role::text, p.created_at
  from public.profiles p
  union all
  select 'guest', null::uuid, g.cid,
         coalesce(last.addr->>'full_name', last.addr->>'fullName', g.email::text), last.addr->>'company', g.email::text, last.addr->>'phone',
         null::text, g.created_at
  from public.guest_customers g
  left join lateral (
    select coalesce(o.shipping_address, o.billing_address) as addr
    from public.orders o
    where lower(o.email::text) = lower(g.email::text) and o.user_id is null and o.status <> 'pending'
    order by o.created_at desc
    limit 1
  ) last on true;

create or replace view public.admin_invoices with (security_invoker = true) as
  select 'manual'::text as kind, i.id, 'INV-M' || i.number as label, i.number, i.issued_on::timestamptz as issued,
         i.bill_to->>'full_name' as name, i.bill_to->>'company' as company, i.bill_to->>'email' as email,
         coalesce(m.phone, i.bill_to->>'phone') as phone, i.total_pence, i.paid_at, i.due_on::timestamptz as due_at, null::text as closed
  from public.invoices i
  left join public.manual_customers m on m.id = i.customer_id
  union all
  select 'order', o.id, 'INV-' || o.number, o.number, o.created_at,
         coalesce(o.billing_address->>'full_name', o.billing_address->>'fullName', o.shipping_address->>'full_name', o.shipping_address->>'fullName', p.full_name, o.email::text),
         coalesce(o.billing_address->>'company', o.shipping_address->>'company', p.company_name),
         o.email::text,
         coalesce(o.shipping_address->>'phone', o.billing_address->>'phone', p.phone),
         o.total_pence, o.paid_at, o.invoice_due_at,
         case when o.status in ('cancelled', 'refunded') then o.status::text end
  from public.orders o
  left join public.profiles p on p.id = o.user_id
  where o.status <> 'pending';

revoke all on public.admin_customers, public.admin_invoices from anon, authenticated;
revoke all on public.guest_customers from anon;

notify pgrst, 'reload schema';
