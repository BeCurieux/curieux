-- Permission-based email sign-ups (the Fit Check page's optional opt-in).
--
-- One row per address. It records the exact wording she agreed to, its
-- version, when she agreed and where she came from (campaign names only),
-- and a token for one-click unsubscribe. Server only: customers and
-- visitors can't read or write it through the API.

create table public.email_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) between 3 and 200 and email = lower(email)),
  consent_text text not null check (char_length(consent_text) between 10 and 500),
  consent_version text not null check (char_length(consent_version) <= 40),
  source text check (char_length(source) <= 60),
  medium text check (char_length(medium) <= 60),
  campaign text check (char_length(campaign) <= 60),
  landing text check (char_length(landing) <= 120),
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text not null unique check (char_length(unsubscribe_token) between 32 and 128),
  created_at timestamptz not null default now()
);

alter table public.email_signups enable row level security;
revoke all on public.email_signups from anon, authenticated;
-- No policies: service role only, like purchases and analytics_events.
