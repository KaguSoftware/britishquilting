-- Date of birth for customers added by hand.
alter table public.manual_customers add column if not exists dob date;

notify pgrst, 'reload schema';
