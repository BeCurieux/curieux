-- Keeping it going, year after year.
--
-- The card is saved at the first purchase, with consent, and next year's
-- book is prepared, announced and then charged unless the family stops it.
-- Every column below exists to make that defensible: what was agreed, when
-- they were told, what they were told, and how they stopped it.
--
-- Off by default. A parent turns it on; it is never assumed. Australian
-- Consumer Law takes a dim view of subscriptions people did not choose, and
-- so, more expensively, do the card schemes.

create type renewal_status as enum (
  'scheduled', 'cancelled', 'charged', 'skipped', 'failed'
);

-- The saved card, and the record that they agreed to it being kept.
alter table profiles
  add column if not exists default_payment_method_id text,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists card_exp_month int,
  add column if not exists card_exp_year int;

-- Per subject, not per family: a parent may want this for one child's
-- archive and not another's.
alter table subjects
  add column if not exists autorenew_enabled boolean not null default false,
  -- What they agreed to, when. Kept because "did they consent" is the whole
  -- question in a dispute, and a boolean alone cannot answer it.
  add column if not exists autorenew_agreed_at timestamptz,
  add column if not exists autorenew_agreed_terms text;

create table renewals (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references subjects(id) on delete cascade,
  book_id           uuid references books(id) on delete set null,
  year_number       int not null,

  status            renewal_status not null default 'scheduled',

  -- The dates that make this fair: when we said we would charge, when we
  -- actually told them, and when we reminded.
  scheduled_for     timestamptz not null,
  announced_at      timestamptz,
  reminded_at       timestamptz,

  -- How it ended.
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users(id) on delete set null,
  charged_at        timestamptz,
  skipped_reason    text,
  failure_reason    text,

  amount_aud        int not null,
  payment_intent_id text,

  created_at        timestamptz not null default now(),
  -- One renewal per subject per year, whatever a retried job believes.
  unique (subject_id, year_number)
);

create index renewals_due_idx on renewals (scheduled_for)
  where status = 'scheduled';

alter table renewals enable row level security;

-- Everyone in the family can see what is going to be charged and when —
-- a renewal only the payer can discover is the thing being avoided here.
create policy "renewals read" on renewals for select using (owns_subject(subject_id));

-- Anyone who can edit may stop it. Deliberately laxer than "owner only":
-- making a charge hard to stop is worth far less than the goodwill it costs.
create policy "renewals cancel" on renewals for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));
