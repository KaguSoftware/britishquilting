-- One email and one phone number per customer. A customer added by hand can't take an email or phone number that
-- another customer already has (another hand-added customer, a website account or a guest), and an account can't
-- change its phone number to one another customer has. Phone numbers are compared by their digits, so
-- 07785 367252, +44 7785 367252 and 0044 7785 367252 are the same number. Emails ignore case.
-- Only new or changed details are checked, so pairs that already clash can still be edited and tidied up.
-- Signing up on the website is never blocked: the email there is the sign-in itself.

-- The digits that identify a phone number: UK numbers without the 0 / 44 / 0044 in front.
create or replace function public.phone_key(p text) returns text
language sql immutable as $$
  select nullif(
    case
      when d like '0044%' then substr(d, 5)
      when d like '44%' and length(d) = 12 then substr(d, 3)
      when d like '0%' then substr(d, 2)
      else d
    end, '')
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create index if not exists manual_customers_email_key_idx on public.manual_customers (lower(email));
create index if not exists manual_customers_phone_key_idx on public.manual_customers (public.phone_key(phone));
create index if not exists manual_customers_alt_phone_key_idx on public.manual_customers (public.phone_key(alt_phone));
create index if not exists profiles_email_key_idx on public.profiles (lower(email::text));
create index if not exists profiles_phone_key_idx on public.profiles (public.phone_key(phone));

-- The first customer (other than the one being saved) who already has this email or one of these phone numbers.
create or replace function public.customer_contact_clash(p_email text, p_phones text[], p_manual uuid, p_profile uuid)
returns table (field text, cid int)
language sql stable security definer set search_path = public as $$
  with e as (select lower(trim(p_email)) as v where nullif(trim(p_email), '') is not null),
       k as (select distinct public.phone_key(x) as v from unnest(coalesce(p_phones, '{}'::text[])) x where public.phone_key(x) is not null)
  select * from (
    select 'email'::text, m.number from public.manual_customers m, e where lower(m.email) = e.v and m.id is distinct from p_manual
    union all
    select 'email', p.cid from public.profiles p, e where lower(p.email::text) = e.v and p.id is distinct from p_profile
    union all
    select 'email', g.cid from public.guest_customers g, e where lower(g.email::text) = e.v
    union all
    select 'phone', m.number from public.manual_customers m, k
      where (public.phone_key(m.phone) = k.v or public.phone_key(m.alt_phone) = k.v) and m.id is distinct from p_manual
    union all
    select 'phone', p.cid from public.profiles p, k where public.phone_key(p.phone) = k.v and p.id is distinct from p_profile
  ) c
  limit 1
$$;
revoke all on function public.customer_contact_clash(text, text[], uuid, uuid) from public, anon, authenticated;

-- The app reads the message: customer_contact_taken:<email|phone>:<cid>
create or replace function public.manual_customers_unique_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  new_email text;
  new_phones text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    new_email := new.email;
    new_phones := array[new.phone, new.alt_phone];
  else
    if new.email is distinct from old.email then new_email := new.email; end if;
    if new.phone is distinct from old.phone then new_phones := new_phones || new.phone; end if;
    if new.alt_phone is distinct from old.alt_phone then new_phones := new_phones || new.alt_phone; end if;
  end if;
  new_phones := array_remove(new_phones, null);
  if new_email is null and cardinality(new_phones) = 0 then return new; end if;
  select * into c from public.customer_contact_clash(new_email, new_phones, new.id, null);
  if found then
    raise exception 'customer_contact_taken:%:%', c.field, c.cid using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists manual_customers_unique_contact on public.manual_customers;
create trigger manual_customers_unique_contact before insert or update of email, phone, alt_phone on public.manual_customers
  for each row execute function public.manual_customers_unique_contact();

create or replace function public.profiles_unique_phone() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if new.phone is null or new.phone is not distinct from old.phone then return new; end if;
  select * into c from public.customer_contact_clash(null, array[new.phone], null, new.id);
  if found then
    raise exception 'customer_contact_taken:%:%', c.field, c.cid using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists profiles_unique_phone on public.profiles;
create trigger profiles_unique_phone before update of phone on public.profiles
  for each row execute function public.profiles_unique_phone();

notify pgrst, 'reload schema';
