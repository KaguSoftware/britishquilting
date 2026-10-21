-- Invoices now print like the British Quilting invoice pad, which has a few more boxes to fill in.
-- Line items may also carry a product code: [{ code, description, quantity, unit_price_pence }].
alter table public.invoices
  add column if not exists deliver_to text,                 -- free text: an address, or "Collected"
  add column if not exists po_number text,
  add column if not exists customer_code text,
  add column if not exists delivery_note_id uuid references public.delivery_notes on delete set null;

create index if not exists invoices_delivery_note_idx on public.invoices (delivery_note_id);

notify pgrst, 'reload schema';
