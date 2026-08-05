-- Keeper — complete database setup.
-- Paste this entire file into the Supabase SQL Editor and press Run.
-- Schema, Row Level Security, private storage, subject types, and the
-- token-gated listen layer for printed QR codes.
-- Safe to run once on a fresh project.

-- ============================================================
-- 0001_schema.sql
-- ============================================================

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

-- ============================================================
-- 0002_rls.sql
-- ============================================================

-- Keeper — Row Level Security.
-- Rule (brief §4): a user must never access another user's children,
-- memories or generated books. Everything is scoped through family ownership.

-- ------------------------------------------------- ownership helpers

create or replace function owns_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from families f where f.id = fid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_child(cid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from children c join families f on f.id = c.family_id
     where c.id = cid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     join children c on c.id = m.child_id
     join families f on f.id = c.family_id
     where m.id = mid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_cluster(clid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memory_clusters mc where mc.id = clid and owns_child(mc.child_id)) $$;

create or replace function owns_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from books b where b.id = bid and owns_child(b.child_id)) $$;

create or replace function owns_page(pid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from book_pages p where p.id = pid and owns_book(p.book_id)) $$;

-- ------------------------------------------------- enable RLS everywhere

alter table profiles            enable row level security;
alter table families            enable row level security;
alter table family_members      enable row level security;
alter table children            enable row level security;
alter table memories            enable row level security;
alter table media_assets        enable row level security;
alter table memory_people       enable row level security;
alter table memory_tags         enable row level security;
alter table memory_clusters     enable row level security;
alter table cluster_memories    enable row level security;
alter table follow_up_questions enable row level security;
alter table little_things       enable row level security;
alter table books               enable row level security;
alter table book_sections       enable row level security;
alter table book_pages          enable row level security;
alter table book_content_blocks enable row level security;
alter table book_approvals      enable row level security;
alter table print_orders        enable row level security;
alter table jobs                enable row level security; -- no policies: service role only

-- ------------------------------------------------- policies

create policy "own profile read"  on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());

create policy "families all" on families for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "family_members all" on family_members for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "children all" on children for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "memories all" on memories for all
  using (owns_child(child_id))
  with check (owns_child(child_id) and created_by = auth.uid());

create policy "media_assets all" on media_assets for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_people all" on memory_people for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_tags all" on memory_tags for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_clusters all" on memory_clusters for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "cluster_memories all" on cluster_memories for all
  using (owns_cluster(cluster_id)) with check (owns_cluster(cluster_id) and owns_memory(memory_id));

create policy "follow_up_questions all" on follow_up_questions for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "little_things all" on little_things for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "books all" on books for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "book_sections all" on book_sections for all
  using (owns_book(book_id)) with check (owns_book(book_id));

create policy "book_pages all" on book_pages for all
  using (owns_book(book_id)) with check (owns_book(book_id));

create policy "book_content_blocks all" on book_content_blocks for all
  using (owns_page(page_id)) with check (owns_page(page_id));

-- Approvals are written by the server after explicit confirmation; users may read their own.
create policy "book_approvals read" on book_approvals for select using (owns_book(book_id));

-- Print orders are created/updated by the server (service role); users may read their own.
create policy "print_orders read" on print_orders for select using (owns_book(book_id));

-- ============================================================
-- 0003_storage.sql
-- ============================================================

-- Keeper — private storage buckets.
-- All child media is private by default (brief §4). No public buckets.
-- Print PDFs are shared with the printer only via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

-- media/: user uploads, path convention  <user_id>/<child_id>/<filename>
-- Users can only touch objects under their own user id folder.
create policy "media owner select" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner insert" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- renders/: generated PDFs. No user policies — service role only.
-- Users receive their digital PDF via server-generated signed URLs.

-- ============================================================
-- 0004_subjects.sql
-- ============================================================

-- Generalise `children` into `subjects`.
--
-- The engine — memories, clustering, questions, provenance, books, print —
-- was always category-agnostic. This migration removes the last assumption
-- that a book is about a child, so the same machinery can carry:
--
--   child   a year of one child's life        "The Year You Were Two"
--   family  a calendar year of a household    "Our Year, 2027"
--   life    a whole life, told in eras        "The Life of Margaret"
--
-- Per-type behaviour (titling, sections, question style, little-thing
-- categories) lives in src/lib/subjects/config.ts, not in the schema.

create type subject_type as enum ('child', 'family', 'life');

-- A life story is chaptered by era rather than by month.
alter type section_type add value if not exists 'era';

-- ---------------------------------------------------------------- table

alter table children rename to subjects;
alter table subjects rename column first_name to display_name;
alter table subjects rename column profile_photo_path to photo_path;

alter table subjects add column subject_type subject_type not null default 'child';

-- A family has no birthday; a life story may only know a birth year.
alter table subjects alter column date_of_birth drop not null;

-- Child books are anchored to a date of birth. Nothing else requires one.
alter table subjects add constraint child_requires_dob
  check (subject_type <> 'child' or date_of_birth is not null);

-- ---------------------------------------------------------------- columns

alter table memories            rename column child_id to subject_id;
alter table memory_clusters     rename column child_id to subject_id;
alter table follow_up_questions rename column child_id to subject_id;
alter table little_things       rename column child_id to subject_id;
alter table books               rename column child_id to subject_id;

alter index memories_child_date_idx rename to memories_subject_date_idx;

-- `year_number` counts a child's years of life. For a family it is the
-- calendar year; for a life story it is unused.
alter table books alter column year_number drop not null;

-- ---------------------------------------------------------------- ownership

-- Policies follow the renamed table automatically, but the helper they call
-- still points at `children`. Replace it, then repoint every dependent policy.
create or replace function owns_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from subjects s join families f on f.id = s.family_id
     where s.id = sid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     join subjects s on s.id = m.subject_id
     join families f on f.id = s.family_id
     where m.id = mid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_cluster(clid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memory_clusters mc
     where mc.id = clid and owns_subject(mc.subject_id)) $$;

create or replace function owns_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from books b where b.id = bid and owns_subject(b.subject_id)) $$;

-- Recreate the policies that referenced owns_child / child_id.
drop policy if exists "children all"            on subjects;
drop policy if exists "memories all"            on memories;
drop policy if exists "memory_clusters all"     on memory_clusters;
drop policy if exists "follow_up_questions all" on follow_up_questions;
drop policy if exists "little_things all"       on little_things;
drop policy if exists "books all"               on books;

create policy "subjects all" on subjects for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "memories all" on memories for all
  using (owns_subject(subject_id))
  with check (owns_subject(subject_id) and created_by = auth.uid());

create policy "memory_clusters all" on memory_clusters for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "follow_up_questions all" on follow_up_questions for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "little_things all" on little_things for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "books all" on books for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

drop function if exists owns_child(uuid);

-- Age remains derived, never stored.
drop function if exists child_age_years(date, date);

create or replace function subject_age_years(dob date, at_date date default current_date)
returns int language sql immutable as
$$ select case when dob is null then null
                else date_part('year', age(at_date, dob))::int end $$;

-- ============================================================
-- 0005_listen.sql
-- ============================================================

-- "Hear this moment" — voice memories reachable from the printed page.
--
-- A printed book is handed to grandparents who will never have an account.
-- So a QR code on the page cannot require a login — but it also must not
-- become a permanent public URL to a family's private recordings (§4).
--
-- The design: each book carries one secret token, minted when the book is
-- approved for print. That token reaches ONLY the recordings printed in that
-- book, and only through a security-definer function that hands back a
-- short-lived signed URL. The token can be revoked without touching the data.

-- ---------------------------------------------------------------- audio

-- Voice memories live in the same private bucket as photographs; nothing
-- about storage becomes public.
alter table media_assets add column if not exists transcript_status processing_status;

-- ---------------------------------------------------------------- token

alter table books add column listen_token uuid;
create unique index books_listen_token_idx on books (listen_token) where listen_token is not null;

-- Minted at approval, so a draft book's QR codes can never resolve.
create or replace function mint_listen_token(bid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select listen_token into t from books where id = bid;
  if t is null then
    t := gen_random_uuid();
    update books set listen_token = t where id = bid;
  end if;
  return t;
end $$;

-- Revoke without deleting anything: the printed codes simply stop resolving.
create or replace function revoke_listen_token(bid uuid)
returns void language sql security definer set search_path = public as
$$ update books set listen_token = null where id = bid and owns_book(bid) $$;

-- ---------------------------------------------------------------- resolve

-- Anonymous callers reach this and nothing else. It answers one question:
-- "does this token's book actually print this memory, and if so where is the
-- audio?" Anything not printed in that book is invisible.
create or replace function resolve_listen(token uuid, mid uuid)
returns table (
  storage_path text,
  mime_type    text,
  transcript   text,
  memory_date  date,
  subject_name text,
  book_title   text
)
language sql stable security definer set search_path = public as $$
  select
    a.storage_path,
    a.mime_type,
    m.transcript,
    m.memory_date,
    s.display_name,
    b.title
  from books b
  join book_pages p          on p.book_id = b.id
  join book_content_blocks c on c.page_id = p.id
  join memories m            on m.id::text = c.content
  join media_assets a        on a.memory_id = m.id
  join subjects s            on s.id = m.subject_id
  where b.listen_token = token
    and b.listen_token is not null
    and m.id = mid
    and m.type = 'voice'
    and a.mime_type like 'audio/%'
  limit 1;
$$;

-- The function is the only door; the tables stay closed.
revoke all on function resolve_listen(uuid, uuid) from public;
grant execute on function resolve_listen(uuid, uuid) to anon, authenticated;

revoke all on function mint_listen_token(uuid) from public;
revoke all on function revoke_listen_token(uuid) from public;
grant execute on function revoke_listen_token(uuid) to authenticated;

-- Which moments in a book can be listened to — used to lay out the QR codes.
create or replace function book_listenable(bid uuid)
returns table (memory_id uuid, page_number int, transcript text)
language sql stable security definer set search_path = public as $$
  select distinct m.id, p.page_number, m.transcript
  from book_pages p
  join book_content_blocks c on c.page_id = p.id
  join memories m            on m.id::text = c.content
  join media_assets a        on a.memory_id = m.id
  where p.book_id = bid
    and owns_book(bid)
    and m.type = 'voice'
    and a.mime_type like 'audio/%'
  order by p.page_number;
$$;

grant execute on function book_listenable(uuid) to authenticated;

