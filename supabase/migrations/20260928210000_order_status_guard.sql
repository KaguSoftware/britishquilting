-- Enforce the order transition map in the database itself. The app already checks
-- can_transition() before every move, but staff can update orders directly through
-- the API (the "staff orders" policy), so without this an order could jump from
-- shipped back to pending and be finalised (and its stock taken) a second time.
-- Undo moves to the immediately previous status stay allowed, as in can_transition().

create or replace function public.orders_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and not public.can_transition(old.status, new.status, public.order_previous_status(old.id)) then
    raise exception 'illegal_transition: % to %', old.status, new.status using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists orders_status_guard on public.orders;
create trigger orders_status_guard before update of status on public.orders
  for each row execute function public.orders_status_guard();
