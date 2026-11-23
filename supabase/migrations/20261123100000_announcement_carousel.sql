-- Announcement bar: several messages that rotate like a carousel, with an owner switch to stop the rotation
-- (when stopped, only the first message is shown, as the single-message bar did before).

alter table public.store_settings add column if not exists announcement_messages text[] not null default '{}';
alter table public.store_settings add column if not exists announcement_rotate boolean not null default true;

update public.store_settings
set announcement_messages = array[announcement]
where announcement is not null and btrim(announcement) <> '' and cardinality(announcement_messages) = 0;

notify pgrst, 'reload schema';
