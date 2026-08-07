-- Qotidia — the whole schema, in one file.
--
-- GENERATED. Do not edit: run `npm run build:setup` instead, or edit the
-- migration it came from. This is the concatenation of
-- supabase/migrations/*.sql in order, provided so that setting up a new
-- project is one paste rather than 19.
--
-- Safe to run once on an empty project. It is not idempotent in the way a
-- migration runner is — if you have already run some of it, run the
-- individual migrations you are missing instead.
--
-- Built from 19 migrations: 0001_schema.sql … 0019_family_archive.sql


-- ======================================================================
-- 0001_schema.sql
-- ======================================================================

-- Qotidia — core schema.
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


-- ======================================================================
-- 0002_rls.sql
-- ======================================================================

-- Qotidia — Row Level Security.
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


-- ======================================================================
-- 0003_storage.sql
-- ======================================================================

-- Qotidia — private storage buckets.
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
--
-- Dropped first so this file can be re-run. The buckets above were already
-- written that way; the policies were not, and they are the part that
-- survives starting over — storage lives in its own schema, so dropping and
-- recreating `public` leaves them behind. Re-running the schema then failed
-- on "policy already exists" after appearing to get all the way through.
drop policy if exists "media owner select" on storage.objects;
drop policy if exists "media owner insert" on storage.objects;
drop policy if exists "media owner update" on storage.objects;
drop policy if exists "media owner delete" on storage.objects;

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


-- ======================================================================
-- 0004_subjects.sql
-- ======================================================================

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


-- ======================================================================
-- 0005_listen.sql
-- ======================================================================

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


-- ======================================================================
-- 0006_copies.sql
-- ======================================================================

-- Extra copies (grandparents).
--
-- The landing page has always promised extra copies at A$79 "when ordered
-- together", but there was nowhere to record how many were bought: the print
-- submission hard-coded a single copy, so a customer who paid for four would
-- have received one. Copies live on the print order because they are a
-- property of the print run, not of the book.
--
-- Bounded in the database as well as the UI: a runaway quantity here is a
-- real cost to us, and the ceiling belongs next to the data.

alter table print_orders
  add column if not exists copies int not null default 1;

alter table print_orders
  drop constraint if exists print_orders_copies_sane;

alter table print_orders
  add constraint print_orders_copies_sane check (copies between 1 and 5);


-- ======================================================================
-- 0007_shared_archive.sql
-- ======================================================================

-- The shared archive.
--
-- Until now a family was one login: families.owner_user_id, and every policy
-- read `owner_user_id = auth.uid()`. Meanwhile the landing page promised
-- "unlimited family contributors, free". This closes that gap.
--
-- The shape:
--   owner        the parent who set it up. Moderates, approves the book, pays.
--   editor       the other parent. Adds directly; nothing to approve.
--   contributor  a grandparent, a godparent. Adds, and what they add waits
--                for the owner. Comments freely.
--
-- Moderation is not distrust — it is the never-invent rule extended to
-- people. The owner is answerable for every word and photograph in a book
-- about their child, so nothing reaches it without them saying yes.

-- ------------------------------------------------------------ memberships

create type family_role as enum ('owner', 'editor', 'contributor');

create table family_memberships (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         family_role not null default 'contributor',
  -- How this person is known to the child, for the book: "Grandpa", "Nonna".
  display_name text,
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_memberships_user_idx on family_memberships(user_id);

-- Everyone who already has a family becomes its owner, so no existing
-- account loses access the moment this lands.
insert into family_memberships (family_id, user_id, role)
select f.id, f.owner_user_id, 'owner' from families f
on conflict (family_id, user_id) do nothing;

-- Exactly one owner per family: the person who pays and approves the print.
create unique index family_one_owner on family_memberships (family_id)
  where role = 'owner';

-- ------------------------------------------------------------ invitations

create table family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  email       text not null,
  role        family_role not null default 'contributor',
  -- Random, single-use, and the only thing the invitee needs.
  token       text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Nobody may be invited as owner; ownership transfers deliberately.
  constraint invitation_not_owner check (role <> 'owner')
);

create index family_invitations_family_idx on family_invitations(family_id);
create unique index family_invitations_pending on family_invitations (family_id, lower(email))
  where accepted_at is null;

-- ------------------------------------------------------------- moderation

create type contribution_status as enum ('approved', 'pending', 'declined');

alter table memories
  add column if not exists contribution_status contribution_status not null default 'approved',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Everything already in the archive was added by the owner, so it stands.
update memories set contribution_status = 'approved' where contribution_status is null;

-- The review queue is read constantly and is almost always short; index the
-- part that matters rather than the whole table.
create index memories_pending_idx on memories (subject_id, created_at desc)
  where contribution_status = 'pending';

-- --------------------------------------------------------------- comments
--
-- Conversation, not book content. A grandmother saying "she's been doing that
-- since she could walk" is worth keeping and is not a caption. Comments never
-- reach the printed page on their own — if something said here belongs in the
-- book, it is added as a memory, with provenance, like everything else.

create table memory_comments (
  id             uuid primary key default gen_random_uuid(),
  memory_id      uuid not null references memories(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 2000),
  created_at     timestamptz not null default now()
);

create index memory_comments_memory_idx on memory_comments(memory_id, created_at);


-- ======================================================================
-- 0008_shared_rls.sql
-- ======================================================================

-- Row Level Security for the shared archive.
--
-- The rule from the brief is unchanged and absolute: a user must never reach
-- another family's subjects, memories or books. What changes is that "this
-- family" is no longer one account — it is everyone with a membership row.
--
-- Access is therefore membership, and what you may *do* is your role:
--
--   read    any member, though a contributor sees approved content plus
--           whatever they themselves have added and is still waiting
--   write   owner and editor freely; a contributor may add, and may edit or
--           withdraw only their own contribution while it is still pending
--   manage  owner alone — access, moderation, print approval
--
-- Every helper is security definer with a pinned search_path, so a policy
-- cannot be subverted by a shadowed table name.

-- ------------------------------------------------------- role helpers

create or replace function family_role_of(fid uuid)
returns family_role language sql stable security definer set search_path = public as
$$ select role from family_memberships
   where family_id = fid and user_id = auth.uid() $$;

create or replace function is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) is not null $$;

create or replace function can_edit_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) in ('owner', 'editor') $$;

create or replace function is_family_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) = 'owner' $$;

-- ---------------------------------------------------- subject helpers

create or replace function family_of_subject(sid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from subjects where id = sid $$;

-- Replaces the old owns_subject: membership, not ownership. Kept under the
-- same name so every policy that already calls it keeps working.
create or replace function owns_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_family_member(family_of_subject(sid)) $$;

create or replace function can_edit_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select can_edit_family(family_of_subject(sid)) $$;

create or replace function owns_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_family_member(fid) $$;

-- A memory is visible to any member once approved; while it is pending only
-- the person who added it and those who can moderate it may see it.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(family_of_subject(m.subject_id))
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(family_of_subject(m.subject_id)))) $$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (can_edit_family(family_of_subject(m.subject_id))
            -- A contributor may correct or withdraw their own, until it is
            -- reviewed. After that it belongs to the archive.
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select can_see_memory(mid) $$;

-- ------------------------------------------------------ enable new tables

alter table family_memberships enable row level security;
alter table family_invitations enable row level security;
alter table memory_comments    enable row level security;

-- ------------------------------------------------------------- families

drop policy if exists "families all" on families;

create policy "families read" on families for select using (is_family_member(id));
create policy "families insert" on families for insert with check (owner_user_id = auth.uid());
create policy "families update" on families for update
  using (is_family_owner(id)) with check (is_family_owner(id));
create policy "families delete" on families for delete using (is_family_owner(id));

-- --------------------------------------------------------- memberships
--
-- Everyone can see who else is in the family — a shared archive with a
-- hidden guest list would be worse than no sharing at all. Only the owner
-- may add, change or remove access.

create policy "memberships read" on family_memberships for select
  using (is_family_member(family_id));
create policy "memberships manage" on family_memberships for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));
-- A member may always remove themselves.
create policy "memberships leave" on family_memberships for delete
  using (user_id = auth.uid() and role <> 'owner');

-- --------------------------------------------------------- invitations

create policy "invitations read" on family_invitations for select
  using (is_family_member(family_id));
create policy "invitations manage" on family_invitations for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- ------------------------------------------------------------- subjects

drop policy if exists "subjects all" on subjects;
drop policy if exists "children all" on subjects;

create policy "subjects read" on subjects for select using (is_family_member(family_id));
create policy "subjects write" on subjects for all
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- ------------------------------------------------------------- memories

drop policy if exists "memories all" on memories;

create policy "memories read" on memories for select using (can_see_memory(id));

-- Anyone in the family may add. What they may set contribution_status to is
-- enforced in the application, which knows the role; the database guarantees
-- only that you cannot add to a family you are not in, and cannot attribute
-- a memory to somebody else.
create policy "memories insert" on memories for insert
  with check (owns_subject(subject_id) and created_by = auth.uid());

create policy "memories update" on memories for update
  using (can_edit_memory(id)) with check (can_edit_memory(id));
create policy "memories delete" on memories for delete using (can_edit_memory(id));

-- --------------------------------------------------- memory attachments

drop policy if exists "media_assets all" on media_assets;
drop policy if exists "memory_people all" on memory_people;
drop policy if exists "memory_tags all" on memory_tags;

create policy "media_assets read" on media_assets for select using (can_see_memory(memory_id));
create policy "media_assets write" on media_assets for all
  using (can_edit_memory(memory_id)) with check (can_see_memory(memory_id));

create policy "memory_people read" on memory_people for select using (can_see_memory(memory_id));
create policy "memory_people write" on memory_people for all
  using (can_edit_memory(memory_id)) with check (can_edit_memory(memory_id));

create policy "memory_tags read" on memory_tags for select using (can_see_memory(memory_id));
create policy "memory_tags write" on memory_tags for all
  using (can_edit_memory(memory_id)) with check (can_edit_memory(memory_id));

-- --------------------------------------------------------------- comments
--
-- Any member may comment and may read the conversation. You may delete your
-- own; the owner may delete any, because they are answerable for the archive.

create policy "comments read" on memory_comments for select
  using (can_see_memory(memory_id));

create policy "comments insert" on memory_comments for insert
  with check (can_see_memory(memory_id) and author_user_id = auth.uid());

create policy "comments update own" on memory_comments for update
  using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());

create policy "comments delete" on memory_comments for delete
  using (
    author_user_id = auth.uid()
    or exists (select 1 from memories m
               where m.id = memory_id and can_edit_family(family_of_subject(m.subject_id)))
  );

-- ------------------------------------------- family_members (descriptive)
--
-- The cast list for the book — "Grandpa", "Nonna" — which is not the same
-- thing as who can log in. Readable by all, edited by owner and editor.

drop policy if exists "family_members all" on family_members;
create policy "family_members read" on family_members for select
  using (is_family_member(family_id));
create policy "family_members write" on family_members for all
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- ------------------------------------------------- everything downstream
--
-- Clusters, questions, little things and books are derived from the archive
-- rather than contributed to it, so they are readable by every member and
-- writable by those who can edit.

drop policy if exists "memory_clusters all" on memory_clusters;
create policy "memory_clusters read" on memory_clusters for select using (owns_subject(subject_id));
create policy "memory_clusters write" on memory_clusters for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "follow_up_questions all" on follow_up_questions;
create policy "questions read" on follow_up_questions for select using (owns_subject(subject_id));
create policy "questions write" on follow_up_questions for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "little_things all" on little_things;
create policy "little_things read" on little_things for select using (owns_subject(subject_id));
create policy "little_things write" on little_things for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "books all" on books;
create policy "books read" on books for select using (owns_subject(subject_id));
create policy "books write" on books for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

-- book_sections / book_pages / book_content_blocks route through owns_book,
-- which routes through owns_subject, so they follow automatically. Writes to
-- book structure are restricted to editors via the same helper.

create or replace function can_edit_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from books b where b.id = bid and can_edit_subject(b.subject_id)) $$;

drop policy if exists "book_sections all" on book_sections;
create policy "book_sections read" on book_sections for select using (owns_book(book_id));
create policy "book_sections write" on book_sections for all
  using (can_edit_book(book_id)) with check (can_edit_book(book_id));

drop policy if exists "book_pages all" on book_pages;
create policy "book_pages read" on book_pages for select using (owns_book(book_id));
create policy "book_pages write" on book_pages for all
  using (can_edit_book(book_id)) with check (can_edit_book(book_id));

drop policy if exists "book_content_blocks all" on book_content_blocks;
create policy "book_content_blocks read" on book_content_blocks for select using (owns_page(page_id));
create policy "book_content_blocks write" on book_content_blocks for all
  using (exists (select 1 from book_pages p where p.id = page_id and can_edit_book(p.book_id)))
  with check (exists (select 1 from book_pages p where p.id = page_id and can_edit_book(p.book_id)));


-- ======================================================================
-- 0009_email.sql
-- ======================================================================

-- Email.
--
-- Two things are recorded here, and both exist to stop the product becoming
-- something people mute.
--
-- The first is what was sent. Sending the same "three things are waiting"
-- twice because a job retried is how a memory archive turns into spam, so
-- every message has a natural key and the table refuses a duplicate.
--
-- The second is what each person wants. Transactional mail — your book is
-- ready, your order shipped — is not optional and is not covered by these
-- preferences; you asked for it by paying. Everything else is.

create type email_kind as enum (
  'invitation',
  'contributions_waiting',
  'book_ready',
  'order_placed',
  'order_shipped',
  'year_closing',
  'one_question',
  'renewal_scheduled',
  'renewal_reminder',
  'renewal_skipped',
  'renewal_payment_failed'
);

/** Which kinds a person may switch off. The rest are transactional. */
create table email_preferences (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  contributions_waiting   boolean not null default true,
  year_closing            boolean not null default true,
  -- Random, stable, and the credential in a one-click unsubscribe link, so
  -- someone can stop the mail without logging in.
  opt_out_token           text not null unique default encode(gen_random_bytes(24), 'base64'),
  updated_at              timestamptz not null default now()
);

create table email_deliveries (
  id             uuid primary key default gen_random_uuid(),
  kind           email_kind not null,
  -- Nullable: an invitation goes to someone who has no account yet.
  user_id        uuid references auth.users(id) on delete set null,
  email          text not null,
  subject_id     uuid references subjects(id) on delete cascade,
  -- One send per logical event. "waiting-<subject>-<date>" collapses a day's
  -- worth of contributions into a single message rather than one per photo.
  dedupe_key     text not null unique,
  provider       text,
  provider_id    text,
  sent_at        timestamptz not null default now()
);

create index email_deliveries_user_idx on email_deliveries(user_id, sent_at desc);

alter table email_preferences enable row level security;
alter table email_deliveries  enable row level security;

create policy "own email preferences" on email_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliveries are written by the sender (service role). A person may see what
-- has been sent to them, which is the least an archive product owes someone.
create policy "own email deliveries" on email_deliveries for select
  using (user_id = auth.uid());


-- ======================================================================
-- 0010_renewals.sql
-- ======================================================================

-- Keeping it going, year after year.
--
-- The card is saved at the first purchase, with consent, and next year's
-- book is prepared, announced and then charged unless the family stops it.
-- Every column below exists to make that defensible: what was agreed, when
-- they were told, what they were told, and how they stopped it.
--
-- Off by default. A parent turns it on; it is never assumed. Australian
-- Consumer Law takes a dim view of subscriptions people did not choose, and
-- so, more expensively, do the card schemes.

create type renewal_status as enum (
  'scheduled', 'cancelled', 'charged', 'skipped', 'failed'
);

-- The saved card, and the record that they agreed to it being kept.
alter table profiles
  add column if not exists default_payment_method_id text,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists card_exp_month int,
  add column if not exists card_exp_year int;

-- Per subject, not per family: a parent may want this for one child's
-- archive and not another's.
alter table subjects
  add column if not exists autorenew_enabled boolean not null default false,
  -- What they agreed to, when. Kept because "did they consent" is the whole
  -- question in a dispute, and a boolean alone cannot answer it.
  add column if not exists autorenew_agreed_at timestamptz,
  add column if not exists autorenew_agreed_terms text;

create table renewals (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references subjects(id) on delete cascade,
  book_id           uuid references books(id) on delete set null,
  year_number       int not null,

  status            renewal_status not null default 'scheduled',

  -- The dates that make this fair: when we said we would charge, when we
  -- actually told them, and when we reminded.
  scheduled_for     timestamptz not null,
  announced_at      timestamptz,
  reminded_at       timestamptz,

  -- How it ended.
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users(id) on delete set null,
  charged_at        timestamptz,
  skipped_reason    text,
  failure_reason    text,

  amount_aud        int not null,
  payment_intent_id text,

  created_at        timestamptz not null default now(),
  -- One renewal per subject per year, whatever a retried job believes.
  unique (subject_id, year_number)
);

create index renewals_due_idx on renewals (scheduled_for)
  where status = 'scheduled';

alter table renewals enable row level security;

-- Everyone in the family can see what is going to be charged and when —
-- a renewal only the payer can discover is the thing being avoided here.
create policy "renewals read" on renewals for select using (owns_subject(subject_id));

-- Anyone who can edit may stop it. Deliberately laxer than "owner only":
-- making a charge hard to stop is worth far less than the goodwill it costs.
create policy "renewals cancel" on renewals for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));


-- ======================================================================
-- 0011_privacy.sql
-- ======================================================================

-- Privacy you can check.
--
-- Reassuring copy is not what makes a parent trust a company with twelve
-- years of their child's life. What does is being able to look: who opened
-- this, what did they take, what did we send anywhere, and what happens if
-- I want it all back or all gone.
--
-- Three things here.
--
--   activity_log     what happened in a family's archive, readable BY the
--                    family — not an internal log they have to ask about
--   archive_exports  every copy of an archive we have ever produced, so a
--                    download is a visible event rather than a silent one
--   deletion_requests  a real, dated, irreversible erasure with a stated
--                      backup window, not a support address

-- --------------------------------------------------------- activity log

create type activity_kind as enum (
  'viewed_archive',
  'viewed_book',
  'downloaded_book',
  'exported_archive',
  'added_memory',
  'approved_contribution',
  'declined_contribution',
  'invited_member',
  'member_joined',
  'removed_member',
  'changed_role',
  'ordered_book',
  'cancelled_renewal',
  'support_access_granted',
  'support_access_used'
);

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  subject_id  uuid references subjects(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  -- Kept as text as well, so the log still reads correctly after someone
  -- has left the family and their row is gone.
  actor_label text not null,
  kind        activity_kind not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create index activity_log_family_idx on activity_log(family_id, created_at desc);

alter table activity_log enable row level security;

-- Everyone in the family can read it. A log only the owner can see would be
-- surveillance; a log nobody can see would be theatre.
create policy "activity read" on activity_log for select using (is_family_member(family_id));
-- Written by the server only. Nobody edits or deletes their own tracks.
create policy "activity no writes" on activity_log for insert with check (false);

-- ------------------------------------------------------------- exports

create table archive_exports (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  requested_by  uuid references auth.users(id) on delete set null,
  status        text not null default 'preparing'
                check (status in ('preparing', 'ready', 'failed', 'expired')),
  storage_path  text,
  size_bytes    bigint,
  item_count    int,
  -- An export is a complete copy of a family's private life in one file, so
  -- it does not sit around indefinitely.
  expires_at    timestamptz not null default now() + interval '7 days',
  created_at    timestamptz not null default now()
);

create index archive_exports_family_idx on archive_exports(family_id, created_at desc);

alter table archive_exports enable row level security;

create policy "exports read" on archive_exports for select using (is_family_member(family_id));
create policy "exports request" on archive_exports for insert
  with check (can_edit_family(family_id) and requested_by = auth.uid());

-- ----------------------------------------------------------- deletion

create table deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  -- Deliberately NOT a cascading foreign key. Everything else about the
  -- family is destroyed; this record has to outlive it, because we must be
  -- able to show that the erasure happened and a receipt that deletes itself
  -- proves nothing. It holds an id and a date — nothing about the child.
  family_id      uuid not null,
  requested_by   uuid references auth.users(id) on delete set null,
  -- Typed the child's name to confirm. Recorded because an irreversible act
  -- should be evidenced, not merely clicked.
  confirmation   text not null,
  status         text not null default 'pending'
                 check (status in ('pending', 'completed', 'cancelled')),
  -- Live data goes immediately; encrypted backups roll off on their own
  -- schedule, and saying so precisely is worth more than claiming instant.
  backups_expire_at timestamptz not null default now() + interval '30 days',
  requested_at   timestamptz not null default now(),
  completed_at   timestamptz
);

alter table deletion_requests enable row level security;

-- Readable while the family still exists; afterwards it is a service-role
-- record only, which is the point of it.
create policy "deletion read" on deletion_requests for select
  using (requested_by = auth.uid() or is_family_member(family_id));
create policy "deletion request" on deletion_requests for insert
  with check (is_family_owner(family_id) and requested_by = auth.uid());

-- ------------------------------------------------- time-boxed support access
--
-- Nobody at this company browses a family's memories as a matter of course.
-- When support genuinely needs to look, the family grants it, it is logged,
-- and it expires by itself rather than relying on someone remembering.

create table support_grants (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  granted_by  uuid not null references auth.users(id) on delete cascade,
  reason      text not null,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint support_grant_is_short check (expires_at < created_at + interval '7 days')
);

create index support_grants_active_idx on support_grants(family_id, expires_at)
  where revoked_at is null;

alter table support_grants enable row level security;

create policy "grants read" on support_grants for select using (is_family_member(family_id));
create policy "grants manage" on support_grants for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

/** Whether support currently has permission to look at a family's archive. */
create or replace function support_access_active(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from support_grants g
     where g.family_id = fid and g.revoked_at is null and g.expires_at > now()) $$;


-- ======================================================================
-- 0012_memory_visibility.sql
-- ======================================================================

-- Keeping something to yourself.
--
-- Sharing an archive with grandparents is the point, but it also means
-- everything a parent writes is read by their mother-in-law. Some things
-- belong in a childhood record and not in that conversation: a hard week, a
-- worry, a thing you want to remember and don't want discussed at Christmas.
--
-- So a memory is either shared with the family or private to whoever wrote
-- it. Two levels, not five — a privacy control nobody understands is worse
-- than none, because people assume the reassuring reading and are wrong.
--
-- A private memory NEVER reaches the book. The book is shared: the whole
-- family reads it and extra copies go to grandparents, so a private note
-- printed on page forty would be the most complete failure of this feature
-- imaginable. The UI says so at the moment of choosing, in those words.

create type memory_visibility as enum ('family', 'private');

alter table memories
  add column if not exists visibility memory_visibility not null default 'family';

-- Private memories are read constantly by exactly one person; index for that
-- rather than across the whole table.
create index memories_private_idx on memories (created_by, created_at desc)
  where visibility = 'private';

-- ------------------------------------------------------------------ RLS

-- Extends the moderation rules already in 0008: a memory must clear both.
-- Being approved does not make a private note visible, and being shared does
-- not make an unapproved contribution visible.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(family_of_subject(m.subject_id))
       -- Private is private, including from the people who can moderate.
       -- A parent who marks something private has not asked anyone to
       -- review it, and an owner who could read it anyway would make the
       -- word meaningless.
       and (m.visibility = 'family' or m.created_by = auth.uid())
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(family_of_subject(m.subject_id)))) $$;

-- Editing follows the same rule: nobody edits what they cannot see.
create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (m.visibility = 'family' or m.created_by = auth.uid())
       and (can_edit_family(family_of_subject(m.subject_id))
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;


-- ======================================================================
-- 0013_scanning.sql
-- ======================================================================

-- Uploads are checked before they are served.
--
-- Until now the browser told the server what it had uploaded and the server
-- wrote it down: MIME type, checksum, dimensions. All three are
-- attacker-controlled, and the MIME type is the one Supabase hands back in a
-- Content-Type header when the file is fetched through a signed URL — so a
-- file uploaded as text/html was a script running on the storage origin.
--
-- A scan job now reads the bytes server-side, corrects the record from them,
-- and records a verdict. Nothing serves an asset that has not reached 'clean'.

-- Separate from processing_status, which answers a different question:
-- processing_status is "has the analysis run", this is "is it safe to serve".
-- A file can be analysed and dangerous, or clean and not yet looked at.
create type scan_verdict as enum ('pending', 'clean', 'quarantined', 'failed');

alter table media_assets
  add column scan_verdict scan_verdict not null default 'pending',
  -- Plain English and shown to the parent, so it says what to do next.
  add column scan_reason  text,
  add column scanned_at   timestamptz,
  -- Kept alongside the corrected mime_type rather than replacing it. A
  -- systematic gap between what browsers claim and what files are is worth
  -- being able to see, and it is the only evidence left after the fact.
  add column declared_mime text,
  -- Which scanner produced the verdict. A row scanned by the mock must not
  -- be indistinguishable later from one a real engine passed.
  add column scanned_by  text,
  -- The engine's signature name, when there was one. Recorded because it is
  -- what makes a refusal auditable; never shown to a parent, because
  -- "Win.Trojan.Agent-1234567" is not an explanation.
  add column scan_signature text;

-- The serving gate is a filter on this column, so it wants an index.
create index media_assets_scan_verdict_idx on media_assets (scan_verdict);

-- Existing rows stay 'pending' deliberately: they were never verified, and
-- back-filling them to 'clean' would be asserting something nobody checked.
-- Re-running the scan job over them is the way to clear them.

-- ------------------------------------------------------------------ RLS
--
-- No new policies. media_assets is already reachable only through family
-- membership, and the verdict is family-visible: a contributor whose upload
-- was refused should be able to see that it was, and why.

-- Only the service role writes a verdict. A client that could set its own
-- would make the whole gate decorative.
revoke update (scan_verdict, scan_reason, scanned_at, scanned_by, scan_signature)
  on media_assets from authenticated, anon;

-- ------------------------------------------------- telling the family
--
-- A refused file is exactly the kind of thing the activity log exists for:
-- something happened to a parent's archive that they did not do. It is also
-- the one entry where the "record people, not content" rule needs care —
-- the reason describes the file's type, never anything about its contents.
alter type activity_kind add value if not exists 'upload_refused';


-- ======================================================================
-- 0014_cover_colour.sql
-- ======================================================================

-- Choosing a cover colour.
--
-- The age spectrum stays the default — it is what makes a shelf of eighteen
-- read as one set. But two things parents want are not expressible in it:
-- changing a single volume, and making every volume the same.
--
-- Two nullable columns rather than one, because those are different wishes
-- and collapsing them loses information. A parent who sets "all walnut" and
-- then makes one book brick must not have that book quietly reset the next
-- time they change the standing preference.

-- The child's standing preference. Null means the age spectrum.
alter table subjects add column cover_colour text;

-- This volume only. Null means "follow the rule above".
alter table books add column cover_colour text;

comment on column subjects.cover_colour is
  'Colour id from AGE_COLOURS, or null for the age spectrum. Not a foreign '
  'key: the palette lives in code, and a colour retired from it must not '
  'break a book printed in it four years ago.';

comment on column books.cover_colour is
  'Colour id from AGE_COLOURS overriding both the subject preference and the '
  'age spectrum, or null to follow them.';

-- ------------------------------------------------------------------ RLS
--
-- No new policies. Both tables are already scoped through family membership,
-- and the write path goes through a server action that checks canEdit — a
-- contributor may add to the archive but not restyle the object that gets
-- printed and posted.
--
-- Not revoked from `authenticated` the way the scan verdict is: this is a
-- preference the family owns, not a verdict about them, and RLS on the row
-- already limits it to their own books.


-- ======================================================================
-- 0015_plans.sql
-- ======================================================================

-- Paying monthly.
--
-- Until now there was one price and one transaction. That was right about
-- the danger — a subscription that delivers nothing is what this product
-- exists to not be — and wrong about the shape: A$199 up front for an object
-- arriving in twelve months makes the eleven months in between feel like
-- waiting rather than keeping.
--
-- The plan lives on the family rather than the profile. A family is what
-- holds subjects, memberships and books, and the archive is what is being
-- paid for. Putting it on the profile would mean a parent with two children
-- in one family somehow having two billing relationships, or a grandparent
-- with contributor access appearing to have a plan of their own.

create type plan_id as enum ('one_off', 'monthly');

create type membership_state as enum (
  'active',      -- paid and current
  'past_due',    -- a payment failed; still full access while Stripe retries
  'cancelled',   -- stopped. Read and export only. Never deleted.
  'none'         -- never subscribed; one-off buyers live here
);

alter table families
  add column plan plan_id not null default 'one_off',
  add column membership_state membership_state not null default 'none',
  add column stripe_subscription_id text,
  -- When the current paid period ends. Access is judged against this rather
  -- than against the cancellation date, so someone who cancels on day 2 of a
  -- month keeps what they paid for until day 30.
  add column paid_until timestamptz,
  -- Counted rather than derived from Stripe invoices, because the credit a
  -- lapsed member is owed must not depend on a third party's API being
  -- reachable at the moment they ask for it.
  add column months_paid_total int not null default 0,
  add column months_paid_this_year int not null default 0;

create unique index families_stripe_subscription_idx
  on families (stripe_subscription_id) where stripe_subscription_id is not null;

comment on column families.months_paid_this_year is
  'Reset when a year closes and its book is made. Decides whether that '
  'book is included (>= MONTHS_FOR_INCLUDED_BOOK) or offered at the '
  'credited price.';

comment on column families.membership_state is
  'cancelled never means deleted. A lapsed family keeps read and export '
  'access to everything for ever — see ACCESS_AFTER_CANCELLING in '
  'lib/billing/plans.ts. Nothing in this schema removes an archive for '
  'non-payment, and nothing ever should.';

-- ------------------------------------------------------------------ RLS
--
-- Billing columns are readable by the family (they are on the families row,
-- which membership already scopes) and writable only by the service role.
-- A client that could set its own membership_state would have a free
-- subscription, and one that could set months_paid_total would have free
-- credit.
revoke update (plan, membership_state, stripe_subscription_id, paid_until,
               months_paid_total, months_paid_this_year)
  on families from authenticated, anon;

-- Every state change, kept. A customer asking "when did I actually cancel"
-- deserves an answer from a record rather than from a Stripe dashboard, and
-- a dispute a year later is decided by whoever has one.
create table billing_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  kind        text not null,
  plan        plan_id,
  state       membership_state,
  amount_aud  int,
  /** Stripe's id for whatever caused this, so the two can be reconciled. */
  external_id text,
  note        text,
  created_at  timestamptz not null default now()
);

create index billing_events_family_idx on billing_events (family_id, created_at desc);

alter table billing_events enable row level security;

-- Readable by the family it belongs to; written only by the service role.
create policy "billing_events read" on billing_events for select
  using (is_family_member(family_id));

-- ------------------------------------------------- renewals under a plan
--
-- A monthly member has already paid for their book across the year. The
-- renewal still happens — the year still closes and the book still goes to
-- print — but no card is charged. That is not 'charged' (no money moved) and
-- not 'skipped' (the book was made), so it needs its own word. Recording it
-- as 'charged' with a zero amount would make revenue reporting wrong and
-- make a customer asking "what did you charge me in March" harder to answer
-- than it should be.
alter type renewal_status add value if not exists 'included';


-- ======================================================================
-- 0016_answers_are_memories.sql
-- ======================================================================

-- An answer is a memory.
--
-- Notice → Ask → Remember only closes if the remembering puts the answer
-- back where the noticing can find it. An answer stored on the question row
-- alone was read exactly once, by the book generator, and was invisible to
-- the analysis, the clustering, the look-back, next year's questions, and
-- the export — which promises a family everything they kept.
--
-- That made the most considered sentences in the archive the only
-- second-class ones. A parent writes "Bun Bun. He came from Nana and he goes
-- everywhere" precisely because we asked. That is not a footnote to a
-- memory; it is one.

alter table follow_up_questions
  add column answer_memory_id uuid references memories(id) on delete set null;

comment on column follow_up_questions.answer_memory_id is
  'The memory created from this answer. Editing the answer updates that row '
  'rather than adding a second one. Null for questions answered before this '
  'migration and for questions never answered.';

create index follow_up_questions_answer_memory_idx
  on follow_up_questions (answer_memory_id) where answer_memory_id is not null;


-- ======================================================================
-- 0017_noticed.sql
-- ======================================================================

-- What we noticed, and what the family said about it.
--
-- Two jobs, and the second is the one that compounds.
--
-- It stops a weekly note repeating itself: an observation shown last Sunday
-- should not be the lead again this Sunday, and without a record there is no
-- way to know.
--
-- And it turns the note into a loop rather than a broadcast. "Keep" means a
-- thread matters and should reach the book. "Ignore" means we were wrong
-- about it, and being told so is the only way this gets better at a family
-- it has never met. A product that observes and never learns is a product
-- that makes the same wrong observation for six years.

create type noticed_verdict as enum ('shown', 'kept', 'more', 'ignored');

create table noticed (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references subjects(id) on delete cascade,
  -- The entity key from lib/graph/extract.ts, e.g. "thing:bun bun". Not a
  -- foreign key: entities are derived, not stored, so that they can be
  -- recomputed whenever the extraction improves without a migration.
  entity_id   text not null,
  -- What was said, kept verbatim. A family asking "why did you tell me that"
  -- deserves the sentence they actually saw, not a reconstruction from
  -- today's code.
  line        text not null,
  shape       text not null,
  verdict     noticed_verdict not null default 'shown',
  -- Which memories the observation was computed from. The provenance rule,
  -- carried into storage: every line can be traced back to the things a
  -- family put there.
  memory_ids  jsonb not null default '[]',
  shown_at    timestamptz not null default now(),
  answered_at timestamptz
);

create index noticed_subject_idx on noticed (subject_id, shown_at desc);
create unique index noticed_recent_idx on noticed (subject_id, entity_id, shown_at);

alter table noticed enable row level security;

-- Family-visible, like the archive it describes. A grandparent who can see
-- the memories can see what was noticed about them. owns_subject() is the
-- existing membership helper from 0008 — the name reads like ownership and
-- means "is in the family that has this subject".
create policy "noticed read" on noticed for select
  using (owns_subject(subject_id));

-- A verdict is an edit to the archive's shape, so it takes the same standard
-- as editing a memory: contributors may add, but only an editor decides that
-- a thread matters. The rows themselves are written by the service role.
create policy "noticed update" on noticed for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));


-- ======================================================================
-- 0018_inbox.sql
-- ======================================================================

-- The Memory Inbox.
--
-- Capture that takes more than a few seconds is capture that stops
-- happening, so this exists to let things arrive without anybody opening the
-- app: shared from a phone, forwarded by a partner, mailed in from a work
-- laptop on the way home.
--
-- The important decision is what is *not* here. There is no inbox table.
--
-- A separate holding area would mean everything else in the product has to
-- learn about it, and the two things that must never miss anything are the
-- export and the Delete Everything button. A parent who deletes their
-- archive and finds forty photographs still sitting in a queue has been lied
-- to, and no amount of care elsewhere makes up for it. So an arrival is a
-- memory from the moment it lands — counted, exported, deleted, part of the
-- graph — and "the inbox" is a view over the few that still have an open
-- question.

create type arrived_via as enum ('share', 'email', 'quick');

-- Rotating an address is an access change: the old one stops working, and
-- anybody who had been mailing things in is now silently unable to. That is
-- worth a family being able to see, in the log they already have.
alter type activity_kind add value if not exists 'inbox_address_rotated';

alter table memories
  -- Null for the ordinary path: added through the app, on purpose.
  add column if not exists arrived_via arrived_via,
  -- Whatever came with it: a share sheet's title, a mail subject. Kept
  -- verbatim and never treated as the memory's text, because a subject line
  -- is what somebody typed into their mail client, not what they'd have
  -- written down as a memory.
  add column if not exists arrival_note text,
  -- Null while something is still unanswered. Not a gate on anything: an
  -- unfiled memory is kept exactly as thoroughly as a filed one.
  add column if not exists filed_at timestamptz;

-- The inbox is the residue, so this index is over the small set.
create index if not exists memories_unfiled_idx
  on memories (subject_id)
  where filed_at is null and arrived_via is not null;

-- ------------------------------------------------------------- the address

-- One private address per child.
--
-- A bearer credential: anyone who knows it can write into this family's
-- archive. Three things follow, and all three are columns here rather than
-- conventions somewhere in the application.
create table subject_inboxes (
  subject_id  uuid primary key references subjects(id) on delete cascade,
  -- Long and random. Never derived from a name or a birthday, which a person
  -- who already knows the family could guess.
  token       text not null unique,
  -- Whether mail from outside the family lands in the review queue or is
  -- refused. Default closed: the privacy brief's rule was to invite people
  -- individually rather than generate something anyone can post to.
  accept_from_anyone boolean not null default false,
  -- Rotating issues a new token in place. Anything given out eventually ends
  -- up somewhere it shouldn't, and a credential you cannot change is one you
  -- can only hope about.
  rotated_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table subject_inboxes enable row level security;

-- Readable by the family, because everyone who can contribute needs the
-- address to contribute by mail.
create policy "inbox address read" on subject_inboxes for select
  using (owns_subject(subject_id));

-- Changed only by someone who can edit the archive. Handing out a write
-- credential is an access decision, and access decisions are an editor's.
create policy "inbox address change" on subject_inboxes for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

create policy "inbox address create" on subject_inboxes for insert
  with check (can_edit_subject(subject_id));


-- ======================================================================
-- 0019_family_archive.sql
-- ======================================================================

-- One archive, many books.
--
-- Until now a memory belonged to a subject: this photograph is Florence's.
-- That was right while Qotidia made one kind of book, and it is wrong the
-- moment it makes two. A morning in Cornwall with Florence, Theo and both
-- grandparents in it is one morning. Asking a family to file it under a
-- child, and then to upload it again under the household, is asking them to
-- do the work the product exists to do.
--
-- So the archive owns the memories, and a book is a question asked of the
-- archive:
--
--   Florence · Two        the memories Florence is in
--   The Wilsons · 2028    the year, all of it
--   Theo · Five           the same Cornwall morning, a different story
--
-- Two rules decide what a book may take, and both are here rather than in
-- application code, because the failure mode of getting them wrong is one
-- family's memories appearing in another family's book.
--
-- **A memory with nobody tagged belongs to the household.** It is in the
-- family annual and in no child's book. The alternative is inferring who a
-- photograph is about, and this product does not infer.
--
-- **A child's book takes only memories tagged with that child.** Not ones
-- that mention them, not ones from the same afternoon. Tagged, by a person.
-- Anything looser is a guess about a child's life dressed as a record of it.
--
-- Threads stay per-story on purpose. A cluster is a thread *within* a book,
-- and the same Cornwall morning supports "collecting shells" in Florence's
-- book and "learning to swim" in Theo's. Those are two threads over one
-- memory, which is the whole point.

-- ------------------------------------------------------------- the owner

alter table memories add column if not exists family_id uuid references families(id) on delete cascade;

update memories m
   set family_id = s.family_id
  from subjects s
 where s.id = m.subject_id
   and m.family_id is null;

-- Anything orphaned by an older bug would silently become unreachable, so it
-- is louder to fail the migration than to ship an archive with holes in it.
alter table memories alter column family_id set not null;

create index if not exists memories_family_idx on memories (family_id, memory_date);

-- ------------------------------------------------------- who it is about

create table if not exists memory_subjects (
  memory_id  uuid not null references memories(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (memory_id, subject_id)
);

create index if not exists memory_subjects_subject_idx on memory_subjects (subject_id);

-- Everything already in the archive is about the subject it was filed under.
insert into memory_subjects (memory_id, subject_id)
select id, subject_id from memories where subject_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------- access
--
-- Order matters here, and not in the way it reads. The column cannot be
-- dropped while anything still depends on it, and the policies on this table
-- do — so the helpers are replaced and the policies removed *first*, and the
-- column goes afterwards. Written the other way round, this migration
-- aborted on a real PostgreSQL with "cannot drop column subject_id because
-- other objects depend on it", which is a far better place to find out than
-- against a production archive.

-- Rewritten to read family_id off the memory directly. It used to reach
-- through the subject, which is about to stop existing here and was always a
-- hop longer than it needed to be.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(m.family_id)
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(m.family_id))) $$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (can_edit_family(m.family_id)
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;

-- Memories were reachable through owns_subject(subject_id), so every policy
-- on the table has to go before the column can.
--
-- Dropped by enumeration rather than by name. The names have changed once
-- already across 0002 and 0008, and a `drop policy if exists` list that has
-- fallen out of date fails silently — it drops nothing, and then the column
-- drop fails with an error naming a policy nobody remembered writing.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'memories'
  loop
    execute format('drop policy %I on memories', p.policyname);
  end loop;
end $$;

-- And one policy on another table reaches into this column: a comment may be
-- deleted by whoever can edit the family the memory belongs to, which it
-- worked out by way of the subject. Restated against the memory's own
-- family, which is what it meant all along and one hop shorter.
drop policy if exists "comments delete" on memory_comments;

-- Now nothing depends on it. Two places recording which subject a memory
-- belongs to is two places to disagree, and this codebase has paid for that
-- mistake more than once — a price in five places, a tagline in two.
alter table memories drop column if exists subject_id;

create policy "comments delete" on memory_comments for delete
  using (
    author_user_id = auth.uid()
    or exists (select 1 from memories m
               where m.id = memory_id and can_edit_family(m.family_id))
  );

create policy "memories read" on memories for select
  using (is_family_member(family_id)
         and (contribution_status = 'approved'
              or created_by = auth.uid()
              or can_edit_family(family_id))
         and (visibility = 'family' or created_by = auth.uid()));

-- A contributor may add. Whether it is published is contribution_status's
-- job, not this policy's.
create policy "memories insert" on memories for insert
  with check (is_family_member(family_id) and created_by = auth.uid());

create policy "memories update" on memories for update
  using (can_edit_memory(id)) with check (is_family_member(family_id));

create policy "memories delete" on memories for delete
  using (can_edit_family(family_id));

create or replace function family_of_memory(mid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from memories where id = mid $$;

-- A link may never cross families.
--
-- Enforced by a trigger rather than by the policy below, because the policy
-- does not run for the service role and several jobs legitimately use it.
-- The failure this prevents is the worst one available in this product: a
-- memory from one family appearing in another family's book. It should not
-- depend on every caller remembering, and it should not depend on which
-- client happened to make the call.
create or replace function memory_subject_same_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if family_of_memory(new.memory_id) is distinct from family_of_subject(new.subject_id) then
    raise exception 'memory % and subject % are not in the same family',
      new.memory_id, new.subject_id;
  end if;
  return new;
end $$;

drop trigger if exists memory_subjects_same_family on memory_subjects;
create trigger memory_subjects_same_family
  before insert or update on memory_subjects
  for each row execute function memory_subject_same_family();

-- The links follow the memory: if you can see it you can see who it is
-- about, and if you can edit it you can say who it is about.
alter table memory_subjects enable row level security;

create policy "memory subjects read" on memory_subjects for select
  using (can_see_memory(memory_id));

create policy "memory subjects write" on memory_subjects for insert
  with check (can_edit_memory(memory_id) and owns_subject(subject_id));

create policy "memory subjects remove" on memory_subjects for delete
  using (can_edit_memory(memory_id));
