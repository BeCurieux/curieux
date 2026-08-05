-- Email.
--
-- Two things are recorded here, and both exist to stop the product becoming
-- something people mute.
--
-- The first is what was sent. Sending the same "three things are waiting"
-- twice because a job retried is how a memory archive turns into spam, so
-- every message has a natural key and the table refuses a duplicate.
--
-- The second is what each person wants. Transactional mail — your book is
-- ready, your order shipped — is not optional and is not covered by these
-- preferences; you asked for it by paying. Everything else is.

create type email_kind as enum (
  'invitation',
  'contributions_waiting',
  'book_ready',
  'order_placed',
  'order_shipped',
  'year_closing'
);

/** Which kinds a person may switch off. The rest are transactional. */
create table email_preferences (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  contributions_waiting   boolean not null default true,
  year_closing            boolean not null default true,
  -- Random, stable, and the credential in a one-click unsubscribe link, so
  -- someone can stop the mail without logging in.
  opt_out_token           text not null unique default encode(gen_random_bytes(24), 'base64'),
  updated_at              timestamptz not null default now()
);

create table email_deliveries (
  id             uuid primary key default gen_random_uuid(),
  kind           email_kind not null,
  -- Nullable: an invitation goes to someone who has no account yet.
  user_id        uuid references auth.users(id) on delete set null,
  email          text not null,
  subject_id     uuid references subjects(id) on delete cascade,
  -- One send per logical event. "waiting-<subject>-<date>" collapses a day's
  -- worth of contributions into a single message rather than one per photo.
  dedupe_key     text not null unique,
  provider       text,
  provider_id    text,
  sent_at        timestamptz not null default now()
);

create index email_deliveries_user_idx on email_deliveries(user_id, sent_at desc);

alter table email_preferences enable row level security;
alter table email_deliveries  enable row level security;

create policy "own email preferences" on email_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliveries are written by the sender (service role). A person may see what
-- has been sent to them, which is the least an archive product owes someone.
create policy "own email deliveries" on email_deliveries for select
  using (user_id = auth.uid());
