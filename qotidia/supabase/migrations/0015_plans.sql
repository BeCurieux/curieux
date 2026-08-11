-- Paying monthly.
--
-- Until now there was one price and one transaction. That was right about
-- the danger — a subscription that delivers nothing is what this product
-- exists to not be — and wrong about the shape: A$199 up front for an object
-- arriving in twelve months makes the eleven months in between feel like
-- waiting rather than keeping.
--
-- The plan lives on the family rather than the profile. A family is what
-- holds subjects, memberships and books, and the archive is what is being
-- paid for. Putting it on the profile would mean a parent with two children
-- in one family somehow having two billing relationships, or a grandparent
-- with contributor access appearing to have a plan of their own.

create type plan_id as enum ('one_off', 'monthly');

create type membership_state as enum (
  'active',      -- paid and current
  'past_due',    -- a payment failed; still full access while Stripe retries
  'cancelled',   -- stopped. Read and export only. Never deleted.
  'none'         -- never subscribed; one-off buyers live here
);

alter table families
  add column plan plan_id not null default 'one_off',
  add column membership_state membership_state not null default 'none',
  add column stripe_subscription_id text,
  -- When the current paid period ends. Access is judged against this rather
  -- than against the cancellation date, so someone who cancels on day 2 of a
  -- month keeps what they paid for until day 30.
  add column paid_until timestamptz,
  -- Counted rather than derived from Stripe invoices, because the credit a
  -- lapsed member is owed must not depend on a third party's API being
  -- reachable at the moment they ask for it.
  add column months_paid_total int not null default 0,
  add column months_paid_this_year int not null default 0;

create unique index families_stripe_subscription_idx
  on families (stripe_subscription_id) where stripe_subscription_id is not null;

comment on column families.months_paid_this_year is
  'Reset when a year closes and its book is made. Decides whether that '
  'book is included (>= MONTHS_FOR_INCLUDED_BOOK) or offered at the '
  'credited price.';

comment on column families.membership_state is
  'cancelled never means deleted. A lapsed family keeps read and export '
  'access to everything for ever — see ACCESS_AFTER_CANCELLING in '
  'lib/billing/plans.ts. Nothing in this schema removes an archive for '
  'non-payment, and nothing ever should.';

-- ------------------------------------------------------------------ RLS
--
-- Billing columns are readable by the family (they are on the families row,
-- which membership already scopes) and writable only by the service role.
-- A client that could set its own membership_state would have a free
-- subscription, and one that could set months_paid_total would have free
-- credit.
revoke update (plan, membership_state, stripe_subscription_id, paid_until,
               months_paid_total, months_paid_this_year)
  on families from authenticated, anon;

-- Every state change, kept. A customer asking "when did I actually cancel"
-- deserves an answer from a record rather than from a Stripe dashboard, and
-- a dispute a year later is decided by whoever has one.
create table billing_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  kind        text not null,
  plan        plan_id,
  state       membership_state,
  amount_aud  int,
  /** Stripe's id for whatever caused this, so the two can be reconciled. */
  external_id text,
  note        text,
  created_at  timestamptz not null default now()
);

create index billing_events_family_idx on billing_events (family_id, created_at desc);

alter table billing_events enable row level security;

-- Readable by the family it belongs to; written only by the service role.
create policy "billing_events read" on billing_events for select
  using (is_family_member(family_id));

-- ------------------------------------------------- renewals under a plan
--
-- A monthly member has already paid for their book across the year. The
-- renewal still happens — the year still closes and the book still goes to
-- print — but no card is charged. That is not 'charged' (no money moved) and
-- not 'skipped' (the book was made), so it needs its own word. Recording it
-- as 'charged' with a zero amount would make revenue reporting wrong and
-- make a customer asking "what did you charge me in March" harder to answer
-- than it should be.
alter type renewal_status add value if not exists 'included';
