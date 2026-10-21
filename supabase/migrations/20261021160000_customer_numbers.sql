-- Customer numbers for customers added by hand, shown as C1001, C1002... The database hands them out in the
-- order customers are added, so two people adding customers at once never get the same one. Customers already
-- there are numbered by the date they were added. Invoices put the number in their Customer Code box.

create sequence if not exists public.manual_customer_number_seq start 1001;

alter table public.manual_customers add column if not exists number int;

update public.manual_customers m
  set number = r.n
  from (
    select id, 1000 + row_number() over (order by created_at, full_name) + coalesce((select max(number) - 1000 from public.manual_customers), 0) as n
    from public.manual_customers where number is null
  ) r
  where m.id = r.id;

-- Carry on after the highest number given so far.
select setval('public.manual_customer_number_seq', greatest(coalesce((select max(number) from public.manual_customers), 1000), 1000));

alter table public.manual_customers alter column number set default nextval('public.manual_customer_number_seq');
alter table public.manual_customers alter column number set not null;
create unique index if not exists manual_customers_number_key on public.manual_customers (number);

notify pgrst, 'reload schema';
