-- Sample customers for the Customers page (Added by hand), to try invoices and delivery notes with.
-- Every one is marked "Sample customer" in its note, so remove_sample_customers.sql can take them all out again.
-- Safe to run more than once: a sample that is already there (same email) is skipped.
-- Contact details are made up: phone numbers are in Ofcom's range kept for drama (07700 900xxx, 020 7946 0xxx)
-- and emails are on example.com, so nothing reaches a real person.
-- They get the next customer numbers (C1001, C1002...) in the order below.

insert into public.manual_customers (full_name, company, email, phone, line1, line2, city, county, postcode, note)
select v.full_name, v.company, v.email, v.phone, v.line1, v.line2, v.city, v.county, v.postcode, 'Sample customer. ' || v.note
from (values
  ('Margaret Ellison', 'Ellison Soft Furnishings', 'margaret@ellison.example.com', '020 7946 0112', 'Unit 4, Mill Yard', 'Chapel Road', 'Ilford', 'Essex', 'IG1 2AB', 'Trade workroom. Linings by the roll, pays on account at 30 days.'),
  ('Raj Patel', 'Patel Upholstery', 'raj@patelupholstery.example.com', '07700 900214', '18 Station Parade', null, 'Romford', 'Essex', 'RM1 3QT', 'Upholsterer. Mostly interlinings and piping cord.'),
  ('Sophie Turner', 'Turner & Wren Interiors', 'studio@turnerwren.example.com', '020 7946 0347', '3 Albion Mews', null, 'London', null, 'W2 2HT', 'Interior designer. Orders for clients, wants P/O numbers on every invoice.'),
  ('David Okafor', null, 'd.okafor@example.com', '07700 900381', '27 Beechwood Avenue', null, 'Barking', 'Essex', 'IG11 9PL', 'Private customer. Collects in person.'),
  ('Helen Murray', 'The Curtain Room', 'helen@curtainroom.example.com', '01234 960455', 'The Old Bakery', 'High Street', 'Saffron Walden', 'Essex', 'CB10 1AA', 'Curtain shop. Monthly order of cotton sateen.'),
  ('Tomasz Nowak', 'Nowak Blinds & Curtains', 'orders@nowakblinds.example.com', '07700 900562', 'Unit 12, Riverside Industrial Estate', null, 'Dagenham', 'Essex', 'RM9 6XY', 'Trade. Delivery on Tuesdays only.'),
  ('Aisha Rahman', null, 'aisha.rahman@example.com', '07700 900618', 'Flat 5, Wren Court', '22 Grove Lane', 'London', null, 'E15 4DD', 'Private customer, phone orders.'),
  ('Peter Hollis', 'Hollis Theatre Supplies', 'peter@hollistheatre.example.com', '020 7946 0733', '9 Stage Door Lane', null, 'London', null, 'SE1 8XX', 'Theatre work. Blackout lining and flame retardant cloth.'),
  ('Catherine Blake', 'Blake Made to Measure', 'cat@blakemtm.example.com', '07700 900874', 'Rose Cottage', 'Church Lane', 'Brentwood', 'Essex', 'CM14 5NR', 'Home workroom. Small cuts, pays by bank transfer.'),
  ('Graham Fuller', 'Fuller Hotels Group', 'purchasing@fullerhotels.example.com', '020 7946 0925', 'Fuller House', '40 Kingsway', 'London', null, 'WC2B 6AA', 'Hotel refurbishments. Large orders, needs delivery notes signed on site.')
) as v(full_name, company, email, phone, line1, line2, city, county, postcode, note)
where not exists (select 1 from public.manual_customers m where lower(m.email) = lower(v.email));
