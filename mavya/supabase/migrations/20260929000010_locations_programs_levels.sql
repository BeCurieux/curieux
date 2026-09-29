-- Where classes happen, and the programs and levels they belong to.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address_line1 text,
  suburb text,
  state text,
  postcode text,
  timezone text not null default 'Australia/Sydney',
  active boolean not null default true,
  unique (organisation_id, id)
);

alter table public.locations enable row level security;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text not null default 'recurring',
  active boolean not null default true,
  unique (organisation_id, id),
  unique (organisation_id, name)
);

alter table public.programs enable row level security;

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  program_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  foreign key (organisation_id, program_id) references public.programs (organisation_id, id) on delete cascade,
  unique (organisation_id, id),
  unique (program_id, id),
  unique (program_id, name)
);

create index levels_program_id_idx on public.levels (program_id);

alter table public.levels enable row level security;
