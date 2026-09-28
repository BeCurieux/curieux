-- Staff memberships: who works for which organisation, and as what.
--
-- A person holds at most one membership per organisation. Only an active
-- membership grants access; invited and suspended ones grant nothing.

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  role text not null check (role in ('owner', 'instructor')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  unique (user_id, organisation_id)
);

create index staff_memberships_organisation_id_idx on public.staff_memberships (organisation_id);

alter table public.staff_memberships enable row level security;
