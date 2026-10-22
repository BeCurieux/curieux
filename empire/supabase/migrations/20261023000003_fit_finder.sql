-- Fit Finder results: her quiz answers, and her 14-day progress (plan
-- ticks, start date, calculator inputs). The report itself is recomputed
-- from the answers by the deterministic engine, so it's never stale.

create table public.fit_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers jsonb not null check (octet_length(answers::text) <= 4000),
  progress jsonb not null default '{}' check (octet_length(progress::text) <= 8000),
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fit_results_user_idx on public.fit_results (user_id, created_at desc);

alter table public.fit_results enable row level security;
revoke all on public.fit_results from anon, authenticated;
grant select, insert, update, delete on public.fit_results to authenticated;

create policy "own fit results" on public.fit_results
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
