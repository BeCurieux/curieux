-- Extra copies (grandparents).
--
-- The landing page has always promised extra copies at A$79 "when ordered
-- together", but there was nowhere to record how many were bought: the print
-- submission hard-coded a single copy, so a customer who paid for four would
-- have received one. Copies live on the print order because they are a
-- property of the print run, not of the book.
--
-- Bounded in the database as well as the UI: a runaway quantity here is a
-- real cost to us, and the ceiling belongs next to the data.

alter table print_orders
  add column if not exists copies int not null default 1;

alter table print_orders
  drop constraint if exists print_orders_copies_sane;

alter table print_orders
  add constraint print_orders_copies_sane check (copies between 1 and 5);
