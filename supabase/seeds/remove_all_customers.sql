-- Deletes every customer: the three kinds listed on the Customers page.
--   1. Customers added by hand (public.manual_customers)
--   2. Website accounts with the customer or trade role (auth.users, which takes public.profiles with it)
--   3. Guests who checked out without an account (public.guest_customers)
-- Staff and owner accounts are kept, so the back office still works afterwards.
--
-- What stays:
--   Orders, invoices and delivery notes. They keep their own copy of the customer's details (email, addresses,
--   bill_to), and their link to the deleted customer is set to null.
--   Newsletter subscribers and stock alerts, which are only email addresses.
--   Customer numbers (CID-xxxx) are not handed out again.
--
-- What goes with an account: its addresses, wishlist and trade applications. Its reviews stay, without the account.
--
-- This cannot be undone. Take a backup first (supabase db dump --data-only > backup.sql).
-- Run it in the Supabase SQL editor, or: psql "$DATABASE_URL" -f supabase/seeds/remove_all_customers.sql
-- It runs as one transaction: if any step fails, nothing is deleted.

begin;

create temporary table doomed_accounts on commit drop as
  select id from public.profiles where role in ('customer', 'trade');

-- These columns point at profiles with no "on delete" rule, so a customer named in one would block the delete.
update public.order_events      set actor_id    = null where actor_id    in (select id from doomed_accounts);
update public.audit_log         set actor_id    = null where actor_id    in (select id from doomed_accounts);
update public.trade_applications set reviewed_by = null where reviewed_by in (select id from doomed_accounts);
update public.posts             set author_id   = null where author_id   in (select id from doomed_accounts);

-- Website accounts. Deleting the auth user removes the profile and everything that cascades from it.
delete from auth.users where id in (select id from doomed_accounts);

-- Customers added by hand.
delete from public.manual_customers;

-- Guests last: unlinking an account's orders above turns that account's email into a guest again
-- (the orders_guest_cid trigger), and this clears those too.
delete from public.guest_customers;

-- What is left should be staff and owners only.
select kind, role, count(*) from public.admin_customers group by kind, role order by kind, role;

commit;
