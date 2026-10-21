-- Custom access token hook: stamps the profile's role and name onto every JWT, so the server can authorise
-- staff from the token alone (getClaims) instead of a profiles lookup per request. A role change reaches the
-- token on its next refresh (at most jwt_expiry, one hour).
-- Enable it in the dashboard: Authentication > Hooks > Customize Access Token > public.custom_access_token_hook.

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable
as $$
declare
  claims jsonb := event->'claims';
  p record;
begin
  select role, full_name into p from public.profiles where id = (event->>'user_id')::uuid;
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(p.role::text, 'customer')));
  claims := jsonb_set(claims, '{full_name}', coalesce(to_jsonb(p.full_name), 'null'::jsonb));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on table public.profiles to supabase_auth_admin;
drop policy if exists "Auth admin reads profiles for token claims" on public.profiles;
create policy "Auth admin reads profiles for token claims" on public.profiles
  as permissive for select to supabase_auth_admin using (true);
