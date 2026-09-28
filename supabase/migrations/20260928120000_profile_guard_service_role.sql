-- The role guard must only restrict end users. Server code using the service role
-- (auth.uid() is null) and SQL run by the owner are trusted callers.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_staff() then
    new.role := old.role;
    new.trade_status := old.trade_status;
  end if;
  if not public.is_owner() and new.role in ('staff','owner') and old.role is distinct from new.role then
    raise exception 'Only the owner can grant staff roles';
  end if;
  return new;
end $$;
