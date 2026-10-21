-- Delivery notes written by hand, laid out like the printed pad. Each one belongs to a customer from
-- the Customers page (manual_customers), so their notes sit next to their invoices.

create sequence if not exists public.delivery_note_number_seq start 1001;

create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  number int unique not null default nextval('public.delivery_note_number_seq'),
  customer_id uuid references public.manual_customers on delete set null,
  invoice_to jsonb not null,                    -- the customer as they were when the note was saved
  deliver_to text,                              -- free text: an address, or "Collected"
  po_number text,
  reference text,
  items jsonb not null default '[]'::jsonb,     -- [{ quantity, description, amount_pence }], quantity is free text ("20 mtrs", "6 x rolls")
  total_pence int not null default 0 check (total_pence >= 0),
  issued_on date not null default (now() at time zone 'Europe/London')::date,
  note text,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists delivery_notes_issued_idx on public.delivery_notes (issued_on desc, number desc);
create index if not exists delivery_notes_customer_idx on public.delivery_notes (customer_id);
drop trigger if exists delivery_notes_touch on public.delivery_notes;
create trigger delivery_notes_touch before update on public.delivery_notes for each row execute function public.touch_updated_at();
alter table public.delivery_notes enable row level security;
drop policy if exists "staff delivery notes" on public.delivery_notes;
create policy "staff delivery notes" on public.delivery_notes for all using (public.is_staff()) with check (public.is_staff());

notify pgrst, 'reload schema';
