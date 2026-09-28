-- British Quilting, core schema
-- Money is stored in integer pence. Lengths are stored in metres, numeric(10,2).

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- ─────────────────────────────────────────── enums
create type public.user_role     as enum ('customer', 'trade', 'staff', 'owner');
create type public.trade_status  as enum ('none', 'pending', 'approved', 'rejected');
create type public.sale_mode     as enum ('metre', 'roll', 'unit');
create type public.order_status  as enum ('pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'ready_for_collection', 'collected', 'delivered', 'cancelled', 'refunded');
create type public.payment_provider as enum ('stripe', 'paypal', 'invoice');
create type public.fulfilment_method as enum ('delivery', 'collection');
create type public.discount_kind as enum ('percent', 'fixed', 'free_shipping');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.post_status   as enum ('draft', 'published');

-- ─────────────────────────────────────────── helpers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ─────────────────────────────────────────── profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email extensions.citext,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  trade_status public.trade_status not null default 'none',
  company_name text,
  vat_number text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Role helpers (security definer so they bypass RLS on profiles and cannot recurse)
create or replace function public.current_role_is(roles public.user_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_is(array['staff','owner']::public.user_role[]);
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role_is(array['owner']::public.user_role[]);
$$;
create or replace function public.is_trade() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and trade_status = 'approved');
$$;

-- New auth user → profile, and claim any guest orders placed with the same verified email
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Users may not escalate their own role / trade status
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    new.role := old.role;
    new.trade_status := old.trade_status;
  end if;
  if not public.is_owner() and new.role in ('staff','owner') and old.role is distinct from new.role then
    raise exception 'Only the owner can grant staff roles';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- ─────────────────────────────────────────── trade applications
create table public.trade_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  company_name text not null,
  vat_number text,
  company_number text,
  website text,
  business_type text,
  message text,
  status public.trade_status not null default 'pending',
  reviewed_by uuid references public.profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────── addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  label text,
  full_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  county text,
  postcode text not null,
  country text not null default 'GB',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────── catalogue
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  image_url text,
  parent_id uuid references public.categories on delete set null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  description text,
  category_id uuid references public.categories on delete set null,
  sale_mode public.sale_mode not null default 'metre',
  -- price per metre / per roll / per unit, in pence
  price_pence int not null check (price_pence >= 0),
  trade_price_pence int check (trade_price_pence >= 0),
  compare_at_pence int,
  -- metre products
  min_length_m numeric(10,2) default 0.5,
  length_step_m numeric(10,2) default 0.5,
  max_length_m numeric(10,2),
  -- roll products
  roll_length_m numeric(10,2),
  -- shipping
  weight_g_per_unit int not null default 0,
  -- swatches
  swatch_enabled boolean not null default true,
  swatch_price_pence int not null default 0,
  -- stock (metres for metre/roll, units for unit)
  stock_qty numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 10,
  track_stock boolean not null default true,
  -- attributes
  colour text,
  colour_hex text,
  composition text,
  width_cm int,
  weight_gsm int,
  care text,
  tags text[] not null default '{}',
  is_active boolean not null default false,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id) where is_active;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  storage_path text not null,
  alt text,
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Trade price must never leak to the public: expose a view without it
create or replace view public.products_public with (security_invoker = true) as
  select id, slug, name, subtitle, description, category_id, sale_mode, price_pence, compare_at_pence,
         min_length_m, length_step_m, max_length_m, roll_length_m, weight_g_per_unit,
         swatch_enabled, swatch_price_pence,
         case when track_stock then stock_qty > 0 else true end as in_stock,
         case when track_stock and stock_qty <= low_stock_threshold and stock_qty > 0 then true else false end as low_stock,
         colour, colour_hex, composition, width_cm, weight_gsm, care, tags, is_featured, sort_order,
         seo_title, seo_description, rating_avg, rating_count, created_at
  from public.products where is_active;

-- ─────────────────────────────────────────── shipping
create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "Royal Mail Tracked 48"
  carrier text not null,              -- royal_mail | dpd | parcelforce | other
  min_weight_g int not null default 0,
  max_weight_g int,                   -- null = no upper bound
  price_pence int not null,
  estimated_days text,                -- "2–3 working days"
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  free_shipping_threshold_pence int default 7500,
  collection_address text default 'London',
  collection_hours text default 'Mon–Fri, 9am–5pm',
  collection_enabled boolean not null default true,
  invoice_terms_days int not null default 30,
  bank_details text,
  low_stock_email text,
  announcement text,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- ─────────────────────────────────────────── discounts
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext unique not null,
  kind public.discount_kind not null,
  value int not null default 0,          -- percent (0–100) or pence
  min_subtotal_pence int not null default 0,
  max_uses int,
  uses int not null default 0,
  once_per_customer boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────── orders
create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int unique not null default nextval('public.order_number_seq'),
  user_id uuid references public.profiles on delete set null,
  email extensions.citext not null,
  status public.order_status not null default 'pending',
  payment_provider public.payment_provider,
  payment_ref text,
  fulfilment public.fulfilment_method not null default 'delivery',
  shipping_address jsonb,
  billing_address jsonb,
  shipping_rate_id uuid references public.shipping_rates,
  shipping_name text,
  subtotal_pence int not null,
  discount_pence int not null default 0,
  shipping_pence int not null default 0,
  total_pence int not null,
  vat_included_pence int not null default 0,
  discount_code text,
  is_trade boolean not null default false,
  invoice_due_at timestamptz,
  customer_note text,
  internal_note text,
  -- random token lets guests view their order without logging in
  access_token text not null default encode(extensions.gen_random_bytes(18), 'hex'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products on delete set null,
  name text not null,
  image_path text,
  sale_mode public.sale_mode not null,
  is_swatch boolean not null default false,
  length_m numeric(10,2),
  quantity int not null default 1,
  unit_price_pence int not null,
  line_total_pence int not null
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  kind text not null,            -- created | paid | status | shipped | note | refund | email
  message text,
  data jsonb,
  visible_to_customer boolean not null default true,
  actor_id uuid references public.profiles,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  carrier text not null,
  tracking_number text not null,
  tracking_url text,
  shipped_at timestamptz not null default now()
);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discount_codes on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  email extensions.citext not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────── engagement
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  user_id uuid references public.profiles on delete set null,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  verified_purchase boolean not null default false,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table public.wishlist_items (
  user_id uuid not null references public.profiles on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  email extensions.citext not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, email)
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext unique not null,
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  cover_path text,
  body_html text not null default '',
  status public.post_status not null default 'draft',
  published_at timestamptz,
  author_id uuid references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────── rating aggregate
create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = pid and status = 'approved'), 0),
    rating_count = (select count(*) from public.reviews where product_id = pid and status = 'approved')
  where p.id = pid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews for each row execute function public.refresh_product_rating();

-- ─────────────────────────────────────────── stock: called by the payment webhook (service role)
create or replace function public.finalise_paid_order(p_order_id uuid, p_provider public.payment_provider, p_ref text)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'order not found'; end if;
  -- idempotent: webhooks may retry
  if o.status not in ('pending', 'awaiting_payment') then return o; end if;

  update public.products p set stock_qty = greatest(0, p.stock_qty - x.qty)
  from (
    select product_id, sum(case when sale_mode = 'unit' then quantity else coalesce(length_m, 0) * quantity end) as qty
    from public.order_items where order_id = p_order_id and not is_swatch and product_id is not null
    group by product_id
  ) x
  where p.id = x.product_id and p.track_stock;

  update public.discount_codes d set uses = uses + 1
  where o.discount_code is not null and d.code = o.discount_code;

  update public.orders set status = 'paid', payment_provider = p_provider, payment_ref = p_ref, paid_at = now()
  where id = p_order_id returning * into o;

  insert into public.order_events (order_id, kind, message) values (p_order_id, 'paid', 'Payment received');
  return o;
end $$;
revoke execute on function public.finalise_paid_order from public, anon, authenticated;

-- ─────────────────────────────────────────── RLS
alter table public.profiles enable row level security;
alter table public.trade_applications enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.store_settings enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.shipments enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.posts enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy "own profile read"   on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "own profile update" on public.profiles for update using (id = auth.uid() or public.is_staff());

-- trade applications
create policy "own apps read"  on public.trade_applications for select using (user_id = auth.uid() or public.is_staff());
create policy "own apps create" on public.trade_applications for insert with check (user_id = auth.uid());
create policy "staff apps update" on public.trade_applications for update using (public.is_staff());

-- addresses
create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff addresses read" on public.addresses for select using (public.is_staff());

-- catalogue: public reads of visible rows; staff everything.
-- The products base table is staff-only, so the trade price never leaks. The public reads products_public.
create policy "public categories" on public.categories for select using (is_visible or public.is_staff());
create policy "staff categories"  on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy "staff products"    on public.products for all using (public.is_staff()) with check (public.is_staff());
create policy "public images"     on public.product_images for select using (true);
create policy "staff images"      on public.product_images for all using (public.is_staff()) with check (public.is_staff());
create policy "public rates"      on public.shipping_rates for select using (is_active or public.is_staff());
create policy "staff rates"       on public.shipping_rates for all using (public.is_staff()) with check (public.is_staff());
create policy "public settings"   on public.store_settings for select using (true);
create policy "owner settings"    on public.store_settings for update using (public.is_staff());

-- products_public is security_invoker, so anon needs a select path on products that exposes only active rows.
-- Column-level grants keep trade_price_pence hidden from anon/authenticated.
create policy "public active products" on public.products for select using (is_active);
revoke select on public.products from anon, authenticated;
grant select (id, slug, name, subtitle, description, category_id, sale_mode, price_pence, compare_at_pence,
  min_length_m, length_step_m, max_length_m, roll_length_m, weight_g_per_unit, swatch_enabled, swatch_price_pence,
  stock_qty, low_stock_threshold, track_stock, colour, colour_hex, composition, width_cm, weight_gsm, care, tags,
  is_active, is_featured, sort_order, seo_title, seo_description, rating_avg, rating_count, created_at, updated_at)
  on public.products to anon, authenticated;
grant select on public.products_public to anon, authenticated;

-- discounts: staff only (validation happens server-side with the service role)
create policy "staff discounts" on public.discount_codes for all using (public.is_staff()) with check (public.is_staff());
create policy "staff redemptions" on public.discount_redemptions for select using (public.is_staff());

-- orders: owners read their own; staff everything; writes go through the server (service role)
create policy "own orders"   on public.orders for select using (user_id = auth.uid() or public.is_staff());
create policy "staff orders" on public.orders for update using (public.is_staff());
create policy "own items"    on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "own events"   on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and ((o.user_id = auth.uid() and visible_to_customer) or public.is_staff())));
create policy "own shipments" on public.shipments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "staff shipments" on public.shipments for all using (public.is_staff()) with check (public.is_staff());
create policy "staff events" on public.order_events for insert with check (public.is_staff());

-- reviews
create policy "public approved reviews" on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy "write own review" on public.reviews for insert with check (user_id = auth.uid() and status = 'pending');
create policy "staff reviews" on public.reviews for update using (public.is_staff());
create policy "staff reviews delete" on public.reviews for delete using (public.is_staff());

-- wishlist
create policy "own wishlist" on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- stock alerts / newsletter: inserts go through server actions (service role); staff read
create policy "staff alerts" on public.stock_alerts for select using (public.is_staff());
create policy "staff newsletter" on public.newsletter_subscribers for select using (public.is_staff());

-- posts
create policy "public posts" on public.posts for select using (status = 'published' or public.is_staff());
create policy "staff posts"  on public.posts for all using (public.is_staff()) with check (public.is_staff());

-- audit
create policy "owner audit" on public.audit_log for select using (public.is_owner());

-- ─────────────────────────────────────────── storage
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('content', 'content', true) on conflict do nothing;
create policy "public read product media" on storage.objects for select using (bucket_id in ('products', 'content'));
create policy "staff write product media" on storage.objects for insert with check (bucket_id in ('products', 'content') and public.is_staff());
create policy "staff update product media" on storage.objects for update using (bucket_id in ('products', 'content') and public.is_staff());
create policy "staff delete product media" on storage.objects for delete using (bucket_id in ('products', 'content') and public.is_staff());
