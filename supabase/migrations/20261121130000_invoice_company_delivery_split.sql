-- Invoices can be written for a company as well as a customer.
-- Delivery notes now hang off one invoice (one note per invoice) and can split the goods across several
-- delivery places: destinations = [{ label, address, items: [{ line, qty }] }], where line is the index of
-- the invoice line being delivered. The quantities across all places must add up to the invoice exactly.

alter table public.invoices add column if not exists company_id uuid references public.companies on delete set null;
create index if not exists invoices_company_idx on public.invoices (company_id);

alter table public.delivery_notes add column if not exists invoice_id uuid unique references public.invoices on delete set null;
alter table public.delivery_notes add column if not exists company_id uuid references public.companies on delete set null;
alter table public.delivery_notes add column if not exists destinations jsonb not null default '[]'::jsonb;
create index if not exists delivery_notes_company_idx on public.delivery_notes (company_id);

-- Carry over the old invoice -> note links (the newest invoice wins when a note was invoiced twice).
update public.delivery_notes d
set invoice_id = i.id
from (
  select distinct on (delivery_note_id) id, delivery_note_id
  from public.invoices
  where delivery_note_id is not null
  order by delivery_note_id, created_at desc
) i
where i.delivery_note_id = d.id and d.invoice_id is null;

-- Existing notes become a single place. Their lines stay in items (legacy shape) and print as before
-- until the note is next saved against its invoice.
update public.delivery_notes
set destinations = jsonb_build_array(jsonb_build_object('label', '', 'address', coalesce(deliver_to, ''), 'items', '[]'::jsonb))
where destinations = '[]'::jsonb;

comment on column public.invoices.delivery_note_id is 'Deprecated: use delivery_notes.invoice_id.';

notify pgrst, 'reload schema';
