-- Email (build step 7). email_events (migration 2) is the idempotency
-- record: a row is claimed before every send, unique per recipient and
-- template, so a retried webhook or a second cron run never sends twice.
--
-- email_suppressions: addresses that unsubscribed from marketing email
-- (the nudges and the onboarding sequence). Receipts, refund confirmations
-- and sign-in links are transactional and still go.

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_suppressions_updated_at before update on public.email_suppressions
  for each row execute function public.set_updated_at();

alter table public.email_suppressions enable row level security;
revoke insert, update, delete, truncate on public.email_suppressions from anon, authenticated;

-- She can see whether she's unsubscribed (the account page asks); only the
-- server changes it.
create policy "email_suppressions: read own" on public.email_suppressions
  for select to authenticated
  using (email = lower((select email from public.profiles where user_id = (select auth.uid()))));
create policy "email_suppressions: admins read all" on public.email_suppressions
  for select to authenticated
  using ((select public.is_admin()));
