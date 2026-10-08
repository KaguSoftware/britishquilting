-- An early version of 20261008150000_manual_invoices.sql created the customers table as
-- invoice_customers. It now lives on the Customers page as manual_customers. Rename it where the
-- early version ran; on a fresh database manual_invoices already makes manual_customers, so this does nothing.
do $$
begin
  if to_regclass('public.invoice_customers') is not null and to_regclass('public.manual_customers') is null then
    alter table public.invoice_customers rename to manual_customers;
    alter table public.manual_customers rename constraint invoice_customers_pkey to manual_customers_pkey;
    alter table public.manual_customers rename constraint invoice_customers_created_by_fkey to manual_customers_created_by_fkey;
    alter index public.invoice_customers_name_idx rename to manual_customers_name_idx;
    alter trigger invoice_customers_touch on public.manual_customers rename to manual_customers_touch;
    alter policy "staff invoice customers" on public.manual_customers rename to "staff manual customers";
  end if;
end $$;

notify pgrst, 'reload schema';
