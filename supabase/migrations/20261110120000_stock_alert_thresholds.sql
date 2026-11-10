-- Staff stock alerts: warn when a product (or one colour) falls to this amount. Null means no alert.
alter table public.products add column if not exists alert_below numeric check (alert_below is null or alert_below >= 0);
alter table public.product_variants add column if not exists alert_below numeric check (alert_below is null or alert_below >= 0);

notify pgrst, 'reload schema';
