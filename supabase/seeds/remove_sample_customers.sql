-- Takes out the customers added by sample_customers.sql (the ones whose note starts "Sample customer.").
-- Invoices and delivery notes written for them stay, with their own copy of the customer's details.
-- Their customer numbers are not handed out again.

delete from public.manual_customers where note like 'Sample customer.%';
