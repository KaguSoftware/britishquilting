-- A second phone number and a gender for customers added by hand.
alter table public.manual_customers add column if not exists alt_phone text;
alter table public.manual_customers add column if not exists gender text
  check (gender is null or gender in ('female', 'male', 'other', 'unspecified'));

notify pgrst, 'reload schema';
