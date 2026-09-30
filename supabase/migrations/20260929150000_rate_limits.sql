-- Postgres-native rate limiting (no Redis/KV in this project). A fixed-window counter:
-- one row per (bucket, identifier, window_start). check_rate_limit atomically bumps the
-- count for the current window and reports whether the caller is still under the limit.
-- Only the service role calls this (src/lib/rate-limit.ts, via createAdminClient()).

create table if not exists public.rate_limits (
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, identifier, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
-- No select/insert policies: this table is only ever touched through check_rate_limit below.

create or replace function public.check_rate_limit(p_bucket text, p_identifier text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  current_count int;
begin
  insert into public.rate_limits (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, win, 1)
  on conflict (bucket, identifier, window_start) do update set count = public.rate_limits.count + 1
  returning count into current_count;

  -- Cheap opportunistic cleanup, no cron job needed: roughly one call in fifty sweeps
  -- windows old enough that nothing will ever look at them again.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return current_count <= p_limit;
end $$;
revoke execute on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
