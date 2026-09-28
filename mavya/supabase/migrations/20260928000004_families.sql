-- Families and the adults who belong to them.
--
-- A family is not owned by any organisation. The link from a provider to a
-- family arrives with enrolments (M2); until then no staff member can see
-- any family, by design.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  relationship text not null,
  is_primary_guardian boolean not null default false,
  unique (family_id, user_id)
);

create index family_members_user_id_idx on public.family_members (user_id);

-- One primary guardian per family at most.
create unique index family_members_one_primary_guardian_idx
  on public.family_members (family_id)
  where is_primary_guardian;

alter table public.family_members enable row level security;
