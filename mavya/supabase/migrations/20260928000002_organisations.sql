-- Organisations: the tenant. Every provider's data hangs off one of these.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  activity_type text not null,
  timezone text not null default 'Australia/Sydney',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;
