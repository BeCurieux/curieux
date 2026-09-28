-- Children. The most sensitive rows in the system.

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null,
  date_of_birth date not null,
  avatar_url text,
  active boolean not null default true
);

create index children_family_id_idx on public.children (family_id);

alter table public.children enable row level security;
