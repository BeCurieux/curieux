-- Keeper — core schema.
-- Every user-owned table gets RLS in 0002_rls.sql. Storage policies in 0003_storage.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums

create type memory_type as enum
  ('photo','video','quote','voice','text','artwork','milestone');

create type processing_status as enum
  ('pending','processing','complete','failed');

create type cluster_status as enum
  ('suggested','confirmed','rejected');

create type question_status as enum
  ('pending','answered','dismissed');

create type book_status as enum
  ('collecting','drafting','review','approved','rendering','print_ready',
   'ordered','in_production','shipped','delivered');

create type section_type as enum
  ('opening','month','people','little_things','theme','trip','quotes',
   'ordinary_days','change_over_time','closing');

create type block_type as enum
  ('text','photo','quote','heading','caption');

create type print_order_status as enum
  ('draft','submitted','in_production','shipped','delivered','cancelled','failed');

create type job_status as enum
  ('queued','running','done','failed','dead');

-- ---------------------------------------------------------------- users

-- Mirrors auth.users; holds billing state. Never store child data here.
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  subscription_status text not null default 'none',
  stripe_customer_id text,
  is_admin           boolean not null default false,
  created_at         timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- family

create table families (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  family_name   text,
  created_at    timestamptz not null default now()
);

create table family_members (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid not null references families(id) on delete cascade,
  name                    text not null,
  relationship            text not null,
  nickname_used_by_child  text,
  photo_path              text,
  created_at              timestamptz not null default now()
);

create table children (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references families(id) on delete cascade,
  first_name         text not null,
  date_of_birth      date not null,
  pronouns           text,
  profile_photo_path text,
  created_at         timestamptz not null default now()
);

-- Age is always derived — never stored (brief §5).
create or replace function child_age_years(dob date, at_date date default current_date)
returns int language sql immutable as
$$ select date_part('year', age(at_date, dob))::int $$;

-- ---------------------------------------------------------------- memories

create table memories (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  created_by   uuid not null references auth.users(id),
  memory_date  date,
  type         memory_type not null,
  raw_text     text,
  transcript   text,
  location     text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index memories_child_date_idx on memories (child_id, memory_date);

create table media_assets (
  id                 uuid primary key default gen_random_uuid(),
  memory_id          uuid not null references memories(id) on delete cascade,
  storage_path       text not null,
  thumbnail_path     text,
  mime_type          text not null,
  width              int,
  height             int,
  duration_seconds   numeric,
  capture_timestamp  timestamptz,
  checksum           text not null,
  processing_status  processing_status not null default 'pending',
  created_at         timestamptz not null default now()
);

-- Exact-duplicate detection: same file for the same memory's child.
create index media_assets_checksum_idx on media_assets (checksum);

create table memory_people (
  memory_id        uuid not null references memories(id) on delete cascade,
  family_member_id uuid not null references family_members(id) on delete cascade,
  primary key (memory_id, family_member_id)
);

create table memory_tags (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references memories(id) on delete cascade,
  tag        text not null,
  source     text not null default 'parent' check (source in ('parent','ai')),
  created_at timestamptz not null default now(),
  unique (memory_id, tag)
);

-- ---------------------------------------------------------------- clusters

create table memory_clusters (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  title      text not null,
  summary    text,
  start_date date,
  end_date   date,
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  status     cluster_status not null default 'suggested',
  created_at timestamptz not null default now()
);

create table cluster_memories (
  cluster_id uuid not null references memory_clusters(id) on delete cascade,
  memory_id  uuid not null references memories(id) on delete cascade,
  primary key (cluster_id, memory_id)
);

-- ---------------------------------------------------------------- questions

create table follow_up_questions (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  cluster_id uuid references memory_clusters(id) on delete set null,
  question   text not null,
  reason     text not null,
  status     question_status not null default 'pending',
  answer     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- little things

create table little_things (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references children(id) on delete cascade,
  recorded_date    date not null default current_date,
  category         text not null,
  value            text not null,
  source_memory_id uuid references memories(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- books

create table books (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references children(id) on delete cascade,
  year_number       int not null,
  title             text not null,
  subtitle          text,
  start_date        date not null,
  end_date          date not null,
  status            book_status not null default 'collecting',
  cover_theme       text,
  page_count        int,
  digital_pdf_path  text,
  print_pdf_path    text,
  cover_pdf_path    text,
  approved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table book_sections (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references books(id) on delete cascade,
  position     int not null,
  section_type section_type not null,
  title        text not null,
  summary      text,
  created_at   timestamptz not null default now()
);

create table book_pages (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  section_id  uuid references book_sections(id) on delete cascade,
  page_number int not null,
  template_id text not null,
  layout_json jsonb not null default '{}'::jsonb,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table book_content_blocks (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references book_pages(id) on delete cascade,
  type          block_type not null,
  content       text not null,
  source_ids    jsonb not null default '[]'::jsonb,
  ai_generated  boolean not null default false,
  parent_edited boolean not null default false,
  created_at    timestamptz not null default now(),
  -- Provenance rule (brief §5/§14): AI-drafted factual text must cite sources.
  constraint ai_text_requires_sources check (
    not ai_generated
    or type not in ('text','caption','quote')
    or jsonb_array_length(source_ids) > 0
  )
);

-- Immutable audit record of exactly what was approved for print (brief §21).
create table book_approvals (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references books(id) on delete cascade,
  approved_by   uuid not null references auth.users(id),
  approved_at   timestamptz not null default now(),
  pdf_checksum  text not null,
  page_count    int not null,
  provider_sku  text not null
);

-- ---------------------------------------------------------------- print

create table print_orders (
  id                uuid primary key default gen_random_uuid(),
  book_id           uuid not null references books(id) on delete cascade,
  provider          text not null,
  provider_order_id text,
  sku               text not null,
  page_count        int not null,
  recipient_json    jsonb not null,
  status            print_order_status not null default 'draft',
  cost_amount       numeric,
  cost_currency     text,
  tracking_number   text,
  tracking_url      text,
  idempotency_key   text not null unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- jobs

-- Background queue. Service-role only; idempotency_key prevents duplicates.
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,
  payload         jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status          job_status not null default 'queued',
  attempts        int not null default 0,
  max_attempts    int not null default 5,
  last_error      text,
  run_after       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index jobs_pending_idx on jobs (status, run_after);

-- Atomically claim the next runnable job (safe under concurrent runners).
create or replace function claim_job()
returns setof jobs language sql security definer set search_path = public as $$
  update jobs set
    status = 'running',
    attempts = attempts + 1,
    updated_at = now()
  where id = (
    select id from jobs
    where status = 'queued' and run_after <= now()
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
$$;
