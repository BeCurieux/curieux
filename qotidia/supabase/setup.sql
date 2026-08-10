-- Qotidia — the whole schema, in one file.
--
-- GENERATED. Do not edit: run `npm run build:setup` instead, or edit the
-- migration it came from. This is the concatenation of
-- supabase/migrations/*.sql in order, provided so that setting up a new
-- project is one paste rather than 28.
--
-- Safe to run once on an empty project. It is not idempotent in the way a
-- migration runner is — if you have already run some of it, run the
-- individual migrations you are missing instead.
--
-- Built from 28 migrations: 0001_schema.sql … 0028_free_cap.sql


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


-- ======================================================================
-- 0020_entities.sql
-- ======================================================================

-- The family memory graph, made durable.
--
-- Until now the graph has been computed and thrown away. buildEntities()
-- reads the tags, works out that Bun Bun is a thing appearing in forty
-- memories, produces a weekly note, and forgets. Every run starts again from
-- strings.
--
-- That is enough to notice things. It is not enough to *know* anything, and
-- the difference is the whole business. An archive that knows "Mimi" and
-- "Grandma Sue" are one grandmother can make a book called Nana & Me. An
-- archive that has two tag strings cannot, and no amount of cleverness later
-- recovers the answer — because the answer was never a computation. It was
-- something a family knew and nobody wrote down.
--
-- So: entities are records. They have their own identity, they carry the
-- names a family has used for them, and the fact that two names are one
-- person is stored the moment somebody says so.
--
-- Three decisions worth arguing about, all of them here rather than in
-- application code.
--
-- **Nothing is ever inferred.** No face matching, no clustering on
-- co-occurrence, no guessing from context. An entity exists because somebody
-- tagged something, and two entities become one because somebody was asked
-- and said yes. See lib/graph/identity.ts, which ranks the questions and
-- deliberately has no opinion about the answers.
--
-- **A "no" is stored as hard as a "yes".** resolutions holds both. The
-- product must never ask twice whether Nana and Grandma are the same person,
-- because asking twice says nobody was listening the first time, and they
-- would be right.
--
-- **Merging is not destructive.** Saying Mimi is Grandma Sue folds one
-- entity into the other and keeps both names as aliases. The family's own
-- word for someone is not a spelling mistake to be corrected — "Mimi" is
-- what a two-year-old called her, and in ten years that is the part worth
-- having.

-- ----------------------------------------------------------- the records

create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  -- person | thing | place | phrase | ritual, matching EntityKind in
  -- lib/graph/presence.ts. Text rather than an enum: this list will grow —
  -- foods, traditions and routines are all coming — and a migration to add
  -- a value to an enum is a lock on a table nobody can afford to lock.
  kind        text not null,
  -- What to call it now. Always one of its own aliases.
  label       text not null,
  -- Set when this entity has been folded into another. The row stays so the
  -- old id keeps resolving; nothing that referenced it breaks.
  merged_into uuid references entities(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint entities_kind_known
    check (kind in ('person', 'thing', 'place', 'phrase', 'ritual'))
);

create index if not exists entities_family_idx on entities(family_id, kind);
create index if not exists entities_merged_idx on entities(merged_into) where merged_into is not null;

-- Every name this family has used for it, including the ones they stopped
-- using. Nothing here is a correction.
create table if not exists entity_aliases (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  label      text not null,
  -- Lowercased for matching. The label above keeps the family's own case.
  key        text not null,
  created_at timestamptz not null default now(),
  unique (entity_id, key)
);

create index if not exists entity_aliases_key_idx on entity_aliases(key);

-- Which memories an entity appears in. Written when somebody tags, so this
-- is a record of what a person did rather than of what we worked out.
create table if not exists entity_memories (
  entity_id  uuid not null references entities(id) on delete cascade,
  memory_id  uuid not null references memories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entity_id, memory_id)
);

create index if not exists entity_memories_memory_idx on entity_memories(memory_id);

-- ------------------------------------------------------- what we've asked
--
-- One row per pair the family has ruled on, in either direction. `pair_key`
-- is the two ids sorted and joined, so the same question cannot be recorded
-- twice by arriving in the other order — see pairKey() in identity.ts, which
-- computes the same string.

create table if not exists entity_resolutions (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  pair_key   text not null,
  same       boolean not null,
  -- Who said so. A resolution is somebody's assertion, not a system fact,
  -- and in five years it may need to be traceable to a person.
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (family_id, pair_key)
);

-- ------------------------------------------------------------------ merge
--
-- One place, so the rule cannot be reimplemented differently by the next
-- caller. Folds `loser` into `winner`: the aliases move, the memory links
-- move, and the loser is left as a tombstone pointing at the winner.
--
-- Deliberately not a trigger. This runs because a person answered a
-- question, and something that rearranges a family's graph should be called
-- on purpose rather than happening as a side effect of a write.
--
-- Not in the activity log, and that is a decision rather than an omission:
-- the log is deliberately short — the events involving another person or a
-- copy of the archive leaving — and a log of everything is a log nobody
-- reads. Resolutions are visible where they matter, on the who's-who page,
-- with the name and the date attached.

create or replace function merge_entities(winner uuid, loser uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  wf uuid;
  lf uuid;
begin
  if winner = loser then
    raise exception 'cannot merge an entity into itself';
  end if;

  select family_id into wf from entities where id = winner;
  select family_id into lf from entities where id = loser;

  if wf is null or lf is null then
    raise exception 'both entities must exist';
  end if;

  -- The check that matters. Two families' graphs must never touch, and the
  -- service role bypasses row-level security, so this cannot live only in a
  -- policy.
  if wf <> lf then
    raise exception 'entities belong to different families';
  end if;

  -- Names move across and nothing is discarded.
  update entity_aliases set entity_id = winner where entity_id = loser
    and key not in (select key from entity_aliases where entity_id = winner);
  delete from entity_aliases where entity_id = loser;

  -- Memory links move, skipping any the winner already has.
  insert into entity_memories (entity_id, memory_id)
    select winner, memory_id from entity_memories where entity_id = loser
    on conflict do nothing;
  delete from entity_memories where entity_id = loser;

  -- The tombstone, so an id held anywhere still resolves.
  update entities set merged_into = winner where id = loser;
end;
$$;

-- ------------------------------------------------------------------- RLS
--
-- Same shape as everything else: a row is visible to the family it belongs
-- to and to nobody else. The alias and link tables have no family_id of
-- their own and reach it through their entity, which is the one join worth
-- paying for rather than denormalising a family id that could drift.

alter table entities           enable row level security;
alter table entity_aliases     enable row level security;
alter table entity_memories    enable row level security;
alter table entity_resolutions enable row level security;

create or replace function family_of_entity(eid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from entities where id = eid $$;

drop policy if exists "entities read" on entities;
create policy "entities read" on entities
  for select using (is_family_member(family_id));

drop policy if exists "entities write" on entities;
create policy "entities write" on entities
  for all using (can_edit_family(family_id))
  with check (can_edit_family(family_id));

drop policy if exists "aliases read" on entity_aliases;
create policy "aliases read" on entity_aliases
  for select using (is_family_member(family_of_entity(entity_id)));

drop policy if exists "aliases write" on entity_aliases;
create policy "aliases write" on entity_aliases
  for all using (can_edit_family(family_of_entity(entity_id)))
  with check (can_edit_family(family_of_entity(entity_id)));

drop policy if exists "entity memories read" on entity_memories;
create policy "entity memories read" on entity_memories
  for select using (is_family_member(family_of_entity(entity_id)));

drop policy if exists "entity memories write" on entity_memories;
create policy "entity memories write" on entity_memories
  for all using (can_edit_family(family_of_entity(entity_id)))
  with check (can_edit_family(family_of_entity(entity_id)));

drop policy if exists "resolutions read" on entity_resolutions;
create policy "resolutions read" on entity_resolutions
  for select using (is_family_member(family_id));

drop policy if exists "resolutions write" on entity_resolutions;
create policy "resolutions write" on entity_resolutions
  for all using (can_edit_family(family_id))
  with check (can_edit_family(family_id));

-- A memory can only ever be linked to an entity of its own family. RLS does
-- not cover the service role, and the seed and the job runner both use it.
create or replace function entity_memory_same_family()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ef uuid;
  mf uuid;
begin
  select family_id into ef from entities where id = new.entity_id;
  select family_id into mf from memories where id = new.memory_id;
  if ef is null or mf is null or ef <> mf then
    raise exception 'entity and memory belong to different families';
  end if;
  return new;
end;
$$;

drop trigger if exists entity_memory_same_family_trg on entity_memories;
create trigger entity_memory_same_family_trg
  before insert or update on entity_memories
  for each row execute function entity_memory_same_family();


-- ======================================================================
-- 0021_storage.sql
-- ======================================================================

-- Counting the bytes.
--
-- Nothing in this product has ever recorded the size of a file. There is no
-- size column on an asset and no total on a family, so "unlimited" has been
-- the implied offer since the first upload — and a household with four
-- hundred gigabytes of 4K video costs more per year than they pay. It is the
-- largest unmodelled liability in the business, and it is invisible right up
-- until it is expensive.
--
-- Two decisions worth arguing about.
--
-- **The total is maintained, not counted.** Summing media_assets on every
-- upload is fine at a thousand families and a table scan at a hundred
-- thousand, and the check runs on the hot path — the moment somebody is
-- adding photographs. A trigger keeps a running total on the family instead.
-- The cost is that a bug in the trigger drifts silently, so there is a
-- function here to recompute from source, and the harness asserts the two
-- agree.
--
-- **Only originals count.** Thumbnails, keyframes and derivatives are our
-- cost of doing business. Charging a family for the previews we chose to
-- generate would be both petty and impossible to explain.
--
-- What this does *not* do is as important. Being full never deletes
-- anything, never locks the archive, and never stops an export. It stops new
-- uploads, which is the only thing that actually costs money — see
-- lib/storage/allowance.ts, where that is enforced by the shape of the type.

alter table media_assets add column if not exists bytes bigint not null default 0;

-- The owning family, carried on the asset itself.
--
-- Denormalised on purpose, and the harness is the reason. Deleting a memory
-- cascades to its assets, and by the time the asset's delete trigger runs the
-- memory row is already gone — so looking the family up from memories returns
-- null, the update matches nothing, and the bytes are never released. A
-- family who deleted a memory would keep paying for it for ever, silently.
--
-- Kept in step by a trigger rather than trusted to callers, and the
-- cross-family check goes with it: an asset must belong to its memory's
-- family and nobody else's.
alter table media_assets add column if not exists family_id uuid references families(id) on delete cascade;

update media_assets a set family_id = m.family_id
  from memories m where m.id = a.memory_id and a.family_id is null;

create index if not exists media_assets_family_idx on media_assets(family_id);

create or replace function media_assets_set_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select family_id into new.family_id from memories where id = new.memory_id;
  if new.family_id is null then
    raise exception 'an asset must belong to a memory that has a family';
  end if;
  return new;
end;
$$;

drop trigger if exists media_assets_set_family_trg on media_assets;
create trigger media_assets_set_family_trg
  before insert or update of memory_id on media_assets
  for each row execute function media_assets_set_family();

alter table families add column if not exists storage_bytes bigint not null default 0;

-- Blocks of extra storage the family has bought. An integer rather than a
-- byte count, so the bill and the allowance cannot disagree about what a
-- block is.
alter table families add column if not exists storage_blocks int not null default 0;

alter table families
  add constraint families_storage_sane check (storage_bytes >= 0 and storage_blocks >= 0)
  not valid;

-- ---------------------------------------------------------- the running total

create or replace function media_assets_count_bytes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Reads new.family_id / old.family_id and never joins back to memories.
  -- That is the whole fix: on a cascading delete the memory is already gone.
  if tg_op = 'INSERT' then
    update families set storage_bytes = storage_bytes + coalesce(new.bytes, 0)
      where id = new.family_id;

  elsif tg_op = 'DELETE' then
    -- greatest(...) so a drifted total can never go negative and leave a
    -- family with a nonsense allowance.
    update families set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0))
      where id = old.family_id;

  elsif old.family_id is not distinct from new.family_id then
    update families
       set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0) + coalesce(new.bytes, 0))
     where id = new.family_id;

  else
    -- An asset moving between families should be impossible. The arithmetic
    -- is here so that if it ever happens the totals still add up rather than
    -- one family carrying another's bytes for ever.
    update families set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0))
      where id = old.family_id;
    update families set storage_bytes = storage_bytes + coalesce(new.bytes, 0)
      where id = new.family_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists media_assets_count_bytes_trg on media_assets;
create trigger media_assets_count_bytes_trg
  after insert or update or delete on media_assets
  for each row execute function media_assets_count_bytes();

-- ------------------------------------------------------------- the safety net
--
-- A maintained total drifts if anything ever writes around the trigger. This
-- recomputes from the assets themselves; the schema harness runs it and
-- asserts nothing moved, which is the only way to know the trigger is still
-- telling the truth.

create or replace function recount_storage(fid uuid default null)
returns void language sql security definer set search_path = public as $$
  update families f
     set storage_bytes = coalesce((
       select sum(a.bytes) from media_assets a where a.family_id = f.id
     ), 0)
   where fid is null or f.id = fid;
$$;

-- Backfill: every asset currently records nothing, so every total is zero and
-- already correct. Run anyway, so the column is right by construction rather
-- than by argument.
select recount_storage();


-- ======================================================================
-- 0022_signed_in_user.sql
-- ======================================================================

-- One name for "who is asking".
--
-- Every row-level security policy in this archive ultimately answers one
-- question — is the person making this request allowed to see this row —
-- and the answer starts with knowing who they are. Until now that was
-- `auth.uid()`, which is a function in Supabase's own schema. It works, and
-- there is nothing wrong with it, but it means the single most important
-- fact in the security model is spelled with somebody else's vendor name.
--
-- The point is not that Supabase is likely to be replaced. It is that a
-- family archive is supposed to outlive its hosting decisions, and the cost
-- of keeping that door open is one function.
--
-- Concretely: moving auth off Supabase today means rewriting three functions
-- and eighteen policies and getting every one of them right, in a system
-- where getting one wrong means one family reading another family's
-- photographs. After this migration it means rewriting one function body.
--
-- ## What this does not change
--
-- Nothing. Not one row's visibility differs before and after. The
-- definitions below were read back out of a live PostgreSQL — pg_proc and
-- pg_policies, after all twenty-one prior migrations had been applied — and
-- the only edit made to them was replacing the call. They are not
-- transcriptions of the migration files, because a transcription is where a
-- privacy hole would come from; several of these functions were redefined
-- two or three times across 0008, 0012 and 0019, and the file you would
-- naturally copy from is not the one that is running.
--
-- The access assertions in the harness are the proof. They ran against the
-- old policies and they run against these, unchanged.

/**
 * The signed-in user, or null.
 *
 * This is the seam. Everything that needs to know who is asking calls this
 * and nothing else, so the day the answer comes from somewhere other than a
 * Supabase JWT — a self-hosted GoTrue, Auth.js, an enterprise SSO — this
 * body changes and the eighteen policies below do not.
 *
 * Marked stable rather than volatile so PostgreSQL inlines it: the planner
 * folds a simple stable SQL function into the expression that calls it, so
 * the indirection costs nothing per row. Not security definer — it reads a
 * request setting and touches no table, so there is no privilege to lend.
 */
create or replace function signed_in_user()
returns uuid language sql stable
set search_path = ''
as $$ select auth.uid() $$;

comment on function signed_in_user() is
  'Who is making this request. The one place the archive learns that, so the identity provider stays replaceable.';

-- ------------------------------------------------------------------ helpers
--
-- Live definitions as of migration 0021, with the call swapped.

create or replace function family_role_of(fid uuid)
returns family_role language sql stable security definer set search_path = public as $$
  select role from family_memberships
   where family_id = fid and user_id = signed_in_user()
$$;

create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memories m
     where m.id = mid
       and is_family_member(m.family_id)
       and (m.contribution_status = 'approved'
            or m.created_by = signed_in_user()
            or can_edit_family(m.family_id)))
$$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memories m
     where m.id = mid
       and (can_edit_family(m.family_id)
            or (m.created_by = signed_in_user() and m.contribution_status = 'pending')))
$$;

-- ----------------------------------------------------------------- policies

drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select using (id = signed_in_user());

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (id = signed_in_user());

drop policy if exists "families insert" on families;
create policy "families insert" on families
  for insert with check (owner_user_id = signed_in_user());

-- Leaving is allowed; an owner leaving would orphan the archive, so that one
-- goes through transferring ownership instead.
drop policy if exists "memberships leave" on family_memberships;
create policy "memberships leave" on family_memberships
  for delete using (user_id = signed_in_user() and role <> 'owner');

drop policy if exists "memories read" on memories;
create policy "memories read" on memories
  for select using (
    is_family_member(family_id)
    and (contribution_status = 'approved'
         or created_by = signed_in_user()
         or can_edit_family(family_id))
    and (visibility = 'family' or created_by = signed_in_user()));

drop policy if exists "memories insert" on memories;
create policy "memories insert" on memories
  for insert with check (is_family_member(family_id) and created_by = signed_in_user());

drop policy if exists "comments insert" on memory_comments;
create policy "comments insert" on memory_comments
  for insert with check (can_see_memory(memory_id) and author_user_id = signed_in_user());

drop policy if exists "comments update own" on memory_comments;
create policy "comments update own" on memory_comments
  for update using (author_user_id = signed_in_user())
  with check (author_user_id = signed_in_user());

drop policy if exists "comments delete" on memory_comments;
create policy "comments delete" on memory_comments
  for delete using (
    author_user_id = signed_in_user()
    or exists (select 1 from memories m
                where m.id = memory_comments.memory_id and can_edit_family(m.family_id)));

drop policy if exists "own email preferences" on email_preferences;
create policy "own email preferences" on email_preferences
  for all using (user_id = signed_in_user()) with check (user_id = signed_in_user());

drop policy if exists "own email deliveries" on email_deliveries;
create policy "own email deliveries" on email_deliveries
  for select using (user_id = signed_in_user());

drop policy if exists "exports request" on archive_exports;
create policy "exports request" on archive_exports
  for insert with check (can_edit_family(family_id) and requested_by = signed_in_user());

drop policy if exists "deletion read" on deletion_requests;
create policy "deletion read" on deletion_requests
  for select using (requested_by = signed_in_user() or is_family_member(family_id));

drop policy if exists "deletion request" on deletion_requests;
create policy "deletion request" on deletion_requests
  for insert with check (is_family_owner(family_id) and requested_by = signed_in_user());

-- ------------------------------------------------------------------ storage
--
-- These are the most vendor-shaped objects in the schema — they live in
-- Supabase's storage schema and use its foldername() helper — and they are
-- the ones most likely to be replaced first, because object storage is where
-- the hosting bill actually is. Swapped anyway, so that "nothing but
-- signed_in_user() knows about auth" is a rule with no exceptions to
-- remember, which is the only kind of rule that survives.

drop policy if exists "media owner select" on storage.objects;
create policy "media owner select" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);


-- ======================================================================
-- 0023_succession.sql
-- ======================================================================

-- Who keeps the archive when the person who made it cannot.
--
-- The reasoning is in lib/succession/policy.ts. This is the storage for it,
-- and two things here are load-bearing rather than incidental.
--
-- **The handover is one function, not a sequence of updates.** Ownership
-- moves in a single transaction that also demotes the previous owner,
-- because there is a unique index allowing exactly one owner per family —
-- so any order of separate statements is briefly illegal, and the failure
-- mode of getting it wrong is a family with no owner at all.
--
-- **Nothing is deleted.** A handover changes who holds the keys. The
-- previous owner keeps their membership and their name stays on everything
-- they wrote. A handover that should not have happened can be reversed by
-- running it the other way.

-- --------------------------------------------------------------- last seen
--
-- Silence is measured against this. Updated at most every few hours by the
-- application, so it costs one no-op update per person per session rather
-- than a write per request.

alter table profiles add column if not exists last_seen_at timestamptz;

-- Everybody who exists today is treated as seen today. The alternative is
-- backdating every account to null and having the first sweep decide a
-- year and a half of silence has already elapsed.
update profiles set last_seen_at = now() where last_seen_at is null;

-- A function rather than an update from the application, so the throttle
-- lives with the column. Called on every authenticated request: the where
-- clause means almost all of those touch no row at all, and none of them
-- read one first.
create or replace function touch_last_seen(uid uuid, stale_hours int default 6)
returns void language sql security definer set search_path = public as $$
  update profiles
     set last_seen_at = now()
   where id = uid
     and (last_seen_at is null or last_seen_at < now() - make_interval(hours => stale_hours));
$$;

comment on function touch_last_seen(uuid, int) is
  'Record that a user is still around. What succession measures silence against.';

-- ----------------------------------------------------------- what to record
--
-- Succession is exactly the class of event the activity log exists for: it
-- changes who controls the archive, and the family reads that log
-- themselves. A refused claim is logged as loudly as a completed one —
-- somebody who tried to take an archive and failed is the single most
-- important thing that log will ever have to say.

alter type activity_kind add value if not exists 'named_keeper';
alter type activity_kind add value if not exists 'removed_keeper';
alter type activity_kind add value if not exists 'succession_claimed';
alter type activity_kind add value if not exists 'succession_refused';
alter type activity_kind add value if not exists 'succession_completed';

-- ----------------------------------------------------------------- keepers

create table if not exists family_keepers (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  -- Named by email, because the point is to work when the person has no
  -- account yet — and the moment that matters is not a good one to be
  -- asking somebody to sign up first.
  email        text not null,
  -- Filled in if and when they do have an account.
  user_id      uuid references auth.users(id) on delete set null,
  -- How the family would say it: "my sister Ruth", "Dad".
  relationship text,
  named_by     uuid references auth.users(id) on delete set null,
  named_at     timestamptz not null default now(),
  -- A keeper may say in advance that they would rather not, and that has to
  -- be recorded rather than leaving the owner to assume.
  declined_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (family_id, email)
);

create index if not exists family_keepers_family_idx on family_keepers(family_id);
create index if not exists family_keepers_email_idx on family_keepers(lower(email));

-- ------------------------------------------------------------------ claims

do $$ begin
  create type succession_opening as enum ('claimed', 'silence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type succession_status as enum ('notice', 'completed', 'refused', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists succession_claims (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  keeper_id   uuid references family_keepers(id) on delete set null,
  opening     succession_opening not null,
  status      succession_status not null default 'notice',
  -- Who the archive would go to, kept separately from keeper_id so the
  -- record still reads correctly if the nomination is later removed.
  keeper_email text not null,
  opened_at   timestamptz not null default now(),
  decides_at  timestamptz not null,
  -- Which reminder days have been sent, so a sweep that runs twice does not
  -- write to a grieving family twice.
  reminded_on int[] not null default '{}',
  settled_at  timestamptz,
  -- Plain English, shown to the family afterwards: "the owner signed in".
  settled_because text,
  created_at  timestamptz not null default now()
);

create index if not exists succession_claims_family_idx on succession_claims(family_id, created_at desc);

-- At most one open claim per family. Two people claiming the same archive at
-- once is not a race to resolve, it is a dispute — and the second one has to
-- be refused at the door rather than arbitrated later.
create unique index if not exists succession_one_open_claim
  on succession_claims (family_id) where status = 'notice';

-- ------------------------------------------------------------- the handover

create or replace function hand_over_family(fid uuid, to_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare previous uuid;
begin
  select owner_user_id into previous from families where id = fid;
  if previous is null then
    raise exception 'no such family';
  end if;
  if previous = to_user then
    return; -- already theirs; a retried job must not fail
  end if;

  -- Demote first. There is a unique index permitting one owner per family,
  -- so promoting before demoting is a constraint violation and the whole
  -- handover would roll back.
  update family_memberships set role = 'editor'
   where family_id = fid and user_id = previous;

  insert into family_memberships (family_id, user_id, role)
       values (fid, to_user, 'owner')
  on conflict (family_id, user_id) do update set role = 'owner';

  update families set owner_user_id = to_user where id = fid;
end;
$$;

comment on function hand_over_family(uuid, uuid) is
  'Move ownership of a family. Demotes the previous owner rather than removing them — nothing about a handover deletes anything.';

-- ---------------------------------------------------------------------- RLS
--
-- A keeper is usually not a member of the family — that is rather the point
-- — so the policies below have to recognise them by email. That is looked up
-- from our own profiles table rather than out of the auth token, which keeps
-- the identity provider behind signed_in_user() where migration 0022 put it.

create or replace function signed_in_email()
returns text language sql stable security definer set search_path = public as $$
  select email from profiles where id = signed_in_user()
$$;

comment on function signed_in_email() is
  'The signed-in user''s email, from profiles. Used where a policy has to recognise somebody who is not a member of the family.';

alter table family_keepers enable row level security;
alter table succession_claims enable row level security;

-- Only the owner names a keeper. An editor is usually the other parent and
-- could reasonably be trusted with it, but "who inherits this" is the one
-- decision that should sit with exactly one person.
create policy "keepers read" on family_keepers for select
  using (is_family_member(family_id) or lower(email) = lower(coalesce(signed_in_email(), '')));

create policy "keepers manage" on family_keepers for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- A claim is visible to the family and to the person who would receive it.
-- The second half matters: a keeper is usually not a member, and a process
-- they cannot see is one they cannot trust.
create policy "claims read" on succession_claims for select
  using (
    is_family_member(family_id)
    or lower(keeper_email) = lower(coalesce(signed_in_email(), ''))
  );

-- Written by the server only. Opening and settling a claim both go through
-- checks that no row-level policy can express.
create policy "claims no writes" on succession_claims for insert with check (false);
create policy "claims no updates" on succession_claims for update using (false);


-- ======================================================================
-- 0024_context.sql
-- ======================================================================

-- What the family told us about a thing.
--
-- The graph can already see that something matters — twenty-three mentions
-- across four years is not a coincidence. What it cannot see is what the
-- thing *was*. This table is where that goes, and it is the single most
-- valuable table in the schema per byte, because everything in it decays
-- outside the database: it lives in one person's memory, it fades, and
-- eventually that person is not there to ask.
--
-- Photographs survive on their own. A competitor starting in ten years can
-- index the same photographs with a better model. They cannot go back and
-- ask what the rabbit was called.
--
-- ## Two decisions
--
-- **A skip is stored, not absent.** "I'd rather not say" and "nobody has
-- asked yet" have to be different rows, because a question re-asked after
-- being declined is worse than one never asked — it says nobody was
-- listening. The unique constraint is what makes settled permanent.
--
-- **Keyed by entity key, not entity id.** An entity id is derived from the
-- archive and is recomputed on every read; the answer has to outlive that.
-- `thing:bun_bun` is stable across rebuilds of the graph in a way that a row
-- id is not.

create table if not exists entity_context (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  -- e.g. 'thing:bun_bun', 'ritual:saturday swimming'.
  entity_key  text not null,
  -- what_is_it | was_it_a_ritual | what_happened
  wondering   text not null,
  -- The family's own words. Null when they chose not to say.
  answer      text,
  skipped     boolean not null default false,
  -- What the arithmetic was at the time, so the answer can be read back with
  -- the question it was answering. Without this, "It just stopped" is a row
  -- nobody can interpret in five years.
  because     text,
  answered_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (family_id, entity_key, wondering),
  -- An answer or a skip, never neither: a row here means the question is
  -- settled, and a settled question with nothing in it is a silenced
  -- question with no reason.
  constraint entity_context_said_something
    check (skipped or (answer is not null and length(btrim(answer)) > 0))
);

create index if not exists entity_context_family_idx on entity_context(family_id);

alter table entity_context enable row level security;

create policy "context read" on entity_context for select
  using (is_family_member(family_id));

-- Anyone who can add to the archive can answer. A grandmother knowing what
-- the rabbit was called is the entire point, and routing it through the
-- owner would lose most of the answers worth having.
create policy "context write" on entity_context for insert
  with check (can_edit_family(family_id) and answered_by = signed_in_user());

-- Editable, because a family correcting themselves is the mechanism this
-- whole thing runs on. Not deletable: a settled question stays settled.
create policy "context amend" on entity_context for update
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));


-- ======================================================================
-- 0025_sharing.sql
-- ======================================================================

-- Sending one story to one person.
--
-- The reasoning is in lib/share/policy.ts, including why this is not the
-- "public share link" the original brief refused. In short: a link reaches
-- one frozen story for thirty days, revocably, and nothing else.
--
-- Two things here carry the weight.
--
-- **The story is frozen into the row.** `payload` holds the title, the
-- caption and the media ids as they were at the moment of sharing. The
-- obvious alternative — store a reference and recompute on open — means the
-- thing a grandmother sees changes as the archive changes underneath her,
-- and the family has no idea what they actually sent. A shared thing has to
-- hold still.
--
-- **Contributions carry no user.** The whole point of sending it to somebody
-- who does not have an account is that they know something we do not, and
-- making them sign up first loses the answer. So a contribution is a name
-- somebody typed and some text, moderated like every other contribution and
-- visible nowhere until the owner keeps it.

create table if not exists shared_stories (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  subject_id    uuid references subjects(id) on delete cascade,
  -- 128 bits, base64url. Unguessable, and the only credential a recipient
  -- has or needs.
  token         text not null unique,
  -- 'found' | 'film'. Text rather than an enum: the set of things worth
  -- sending will grow, and a migration per artefact is friction with no
  -- safety attached.
  kind          text not null,
  -- The story as it was when it was sent. See above.
  payload       jsonb not null,
  shared_by     uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  allow_contributions boolean not null default true,
  -- A count, never a log of individuals. Knowing a link was opened eleven
  -- times is useful; knowing which relative opened it at 2am is
  -- surveillance, and the family did not ask us to watch their mother.
  view_count    int not null default 0,
  last_viewed_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists shared_stories_family_idx on shared_stories(family_id, created_at desc);

create table if not exists story_contributions (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references shared_stories(id) on delete cascade,
  -- Denormalised so the owner's review query does not have to join through
  -- a share that may since have been revoked.
  family_id   uuid not null references families(id) on delete cascade,
  -- What they typed, not an account. There may not be one.
  said_by     text not null,
  body        text not null,
  -- Optional, and only used to invite them properly if the family wants to.
  -- Never required: asking for an email before an answer loses the answer.
  email       text,
  status      text not null default 'pending'
              check (status in ('pending', 'kept', 'declined')),
  -- The memory this became, once the family kept it.
  memory_id   uuid references memories(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint story_contributions_said_something
    check (length(btrim(body)) > 0 and length(body) <= 2000),
  constraint story_contributions_named
    check (length(btrim(said_by)) > 0 and length(said_by) <= 60)
);

create index if not exists story_contributions_family_idx
  on story_contributions(family_id, status, created_at desc);
create index if not exists story_contributions_share_idx on story_contributions(share_id);

-- ---------------------------------------------------------------------- RLS

alter table shared_stories enable row level security;
alter table story_contributions enable row level security;

-- The family can see what they have sent. Nobody else can list shares —
-- a recipient reaches exactly one row, by token, through the server.
create policy "shares read" on shared_stories for select
  using (is_family_member(family_id));

create policy "shares manage" on shared_stories for all
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- Contributions are readable by the family they were sent to, and by nobody
-- else. The person who wrote one cannot read it back — they have no account
-- and no session, and a URL that returns other people's answers is a
-- different product.
create policy "contributions read" on story_contributions for select
  using (is_family_member(family_id));

create policy "contributions moderate" on story_contributions for update
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- Written by the server only. A contribution arrives from an anonymous
-- request, so the checks that matter — is the link live, has it had too
-- many, is the text within length — are not expressible as a policy and are
-- done in one place with the service role.
create policy "contributions no direct writes" on story_contributions
  for insert with check (false);

-- ---------------------------------------------------------- opening a link
--
-- Resolving a token has to work for somebody with no account at all, which
-- no row-level policy can express. Security definer, and deliberately narrow:
-- it takes a token, returns one row, and cannot be made to return a second.
--
-- It counts the view as a side effect, because the alternative is a second
-- round trip that the caller can forget.

create or replace function open_shared_story(t text)
returns table (
  id uuid,
  family_id uuid,
  subject_id uuid,
  kind text,
  payload jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  allow_contributions boolean,
  contribution_count int
)
language plpgsql security definer set search_path = public as $$
begin
  -- Shape-checked before the lookup so a token-guessing loop is refused
  -- without touching the table.
  if t !~ '^[A-Za-z0-9_-]{22}$' then
    return;
  end if;

  update shared_stories s
     set view_count = s.view_count + 1, last_viewed_at = now()
   where s.token = t;

  return query
    select s.id, s.family_id, s.subject_id, s.kind, s.payload,
           s.expires_at, s.revoked_at, s.allow_contributions,
           (select count(*)::int from story_contributions c where c.share_id = s.id)
      from shared_stories s
     where s.token = t;
end;
$$;

comment on function open_shared_story(text) is
  'Resolve a share token for somebody with no account. Counts the view; never returns more than one story.';

-- Anonymous callers need to be able to run it. They can reach exactly one
-- row, only with a token they were given.
grant execute on function open_shared_story(text) to anon, authenticated;

-- ------------------------------------------------ who remembered it
--
-- A contribution kept by the family becomes an ordinary memory. The person
-- who wrote it has no account, so created_by cannot point at them — it
-- points at the owner who kept it, which is accurate about who put the row
-- there and wrong about whose memory it is.
--
-- So the name travels with the words. It matters in the book: "That was the
-- morning we drove to the coast — Gran" is a different sentence from the
-- same words unattributed, and the difference is the whole reason to have
-- asked her.

alter table memories add column if not exists contributed_by_name text;

-- ------------------------------------------------------------ what to record

alter type activity_kind add value if not exists 'shared_story';
alter type activity_kind add value if not exists 'revoked_share';
alter type activity_kind add value if not exists 'story_contribution';


-- ======================================================================
-- 0026_support_access.sql
-- ======================================================================

-- Two things about who may read a family's memories.
--
-- The second is the one this migration was opened for. The first was found
-- on the way and matters more.
--
--
-- ## 1. "Keep this to myself" was only half true
--
-- The rule that a private memory is private was written in two places: the
-- `memories read` policy, and can_see_memory(). 0012 introduced it in both.
-- 0019 and 0022 each rewrote the function — for unrelated reasons, one to
-- move to the family_id column and one to swap auth.uid() for
-- signed_in_user() — and neither carried the visibility clause across. The
-- policy kept it. The function lost it.
--
-- Nothing failed, because the two are only ever compared by reading them.
-- The result, verified against a live database rather than reasoned about:
--
--     as a contributor, reading the owner's private memory
--       memories row    0     <- correctly hidden
--       media_assets    1     <- the photograph
--       can_see_memory  true
--
-- The row is hidden and the file is not. can_see_memory() also gates
-- memory_people, memory_tags, memory_comments and memory_subjects, so the
-- tags and the people on a private memory were readable too. Meanwhile the
-- upload page's checkbox says "Only you can see this... nobody else in the
-- family will ever see it."
--
-- The fix is not to patch the function to match the policy. It is to have
-- one copy: can_see_memory() carries the whole rule, and `memories read`
-- calls it, which is what 0008 did before 0012 inlined a second version.
-- Two copies of a privacy rule will diverge again — this one took three
-- migrations.
--
--
-- ## 2. The support grant unlocked nothing
--
-- support_access_active() has existed since 0011 and is referenced by no
-- policy. A family could grant support access from their settings, the grant
-- was recorded, it expired on its own, it appeared in the activity log — and
-- it permitted exactly nothing, because the only way anybody here could read
-- an archive was the service credential, which bypasses row-level security
-- entirely and does not consult grants.
--
-- A consent a family gives that unlocks nothing is worse than not offering
-- it. So the grant becomes a real key, and a deliberately small one:
--
--   **Staff and a live grant, both.** Being an administrator grants nothing
--   on its own. There is no path here that a grant alone opens either.
--
--   **Read only.** No insert, update or delete, on anything. "Support never
--   edits your archive" stops being a promise and becomes a fact about the
--   database.
--
--   **Never private.** Support reads strictly less than a family member
--   does. It runs through can_see_memory_as_support(), which is the ordinary
--   rule with the membership test swapped and the private exclusion made
--   unconditional — a parent's private note is not a support matter.
--
--   **Five tables.** Subjects, memories, media assets, books and pages: what
--   is needed to answer "why is her book stuck". Not comments, not people,
--   not tags, not the entity graph.
--
-- What this does not do, and the /help page says so in as many words: the
-- service credential that runs the product can still read any row. This
-- closes the supported path, not physics.

-- ---------------------------------------------------------------- 1. private

-- The whole rule, in one place. The last clause is the one that went missing.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and is_family_member(m.family_id)
        and (m.contribution_status = 'approved'
             or m.created_by = signed_in_user()
             or can_edit_family(m.family_id))
        -- Private is private, including from the people who can moderate.
        -- A parent who marks something private has not asked anybody to
        -- review it, and an owner who could read it anyway would make the
        -- word meaningless.
        and (m.visibility = 'family' or m.created_by = signed_in_user())) $$;

-- And the policy defers to it rather than restating it. This is the line
-- whose absence let the two drift for three migrations.
drop policy if exists "memories read" on memories;
create policy "memories read" on memories for select using (can_see_memory(id));

-- Editing had the same hole: 0012 excluded private from can_edit_memory and
-- 0019/0022 dropped that too. An owner could not see another member's
-- private memory and could still update it by id.
create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and (m.visibility = 'family' or m.created_by = signed_in_user())
        and (can_edit_family(m.family_id)
             or (m.created_by = signed_in_user() and m.contribution_status = 'pending'))) $$;

-- ---------------------------------------------------------------- 2. support

/** Whether the signed-in person is staff here. Says nothing about access. */
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(
     (select p.is_admin from profiles p where p.id = signed_in_user()), false) $$;

/**
 * Whether support may read this family right now.
 *
 * Both halves, always. An administrator with no grant reads nothing, and a
 * grant with nobody to use it opens nothing.
 */
create or replace function support_may_read(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_staff() and support_access_active(fid) $$;

/**
 * A memory, as support may see it.
 *
 * Strictly less than a family member sees. The private exclusion has no
 * "unless you wrote it" escape here, because support wrote none of it and a
 * parent's private note is not a support matter. Unapproved contributions
 * are excluded for the same reason: they are not yet part of the archive
 * and nobody outside the family has been asked to look at them.
 */
create or replace function can_see_memory_as_support(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and support_may_read(m.family_id)
        and m.visibility = 'family'
        and m.contribution_status = 'approved') $$;

-- The five tables. Select only, every one of them — there is deliberately no
-- support policy anywhere in this file that permits a write.
drop policy if exists "subjects support read" on subjects;
create policy "subjects support read" on subjects
  for select using (support_may_read(family_id));

drop policy if exists "memories support read" on memories;
create policy "memories support read" on memories
  for select using (can_see_memory_as_support(id));

drop policy if exists "media_assets support read" on media_assets;
create policy "media_assets support read" on media_assets
  for select using (can_see_memory_as_support(memory_id));

-- books hangs off subject_id, not family_id, and book_pages off book_id.
-- Routed through the same helpers the ordinary policies use rather than a
-- second way of spelling the same join.
drop policy if exists "books support read" on books;
create policy "books support read" on books
  for select using (support_may_read(family_of_subject(subject_id)));

drop policy if exists "book_pages support read" on book_pages;
create policy "book_pages support read" on book_pages
  for select using (
    exists (select 1 from books b
             where b.id = book_pages.book_id
               and support_may_read(family_of_subject(b.subject_id))));


-- ======================================================================
-- 0027_support_view.sql
-- ======================================================================

-- The two rows support needs in order to know a grant exists.
--
-- 0026 made the grant a real key and left support unable to find the door.
-- Both of the tables that say "this family has asked for help" are gated on
-- family membership, which staff are not:
--
--     grants read    is_family_member(family_id)
--     families read  is_family_member(id)
--
-- So a support view could read a family's memories once it knew the family
-- id, and had no way to learn one. Two policies, both select, both minimal.

-- A grant is a message addressed to us. Its family id, its reason and its
-- expiry are the whole of what a family wrote when they asked for help, and
-- staff being unable to read their own inbox is not a privacy property.
--
-- Deliberately not gated on support_may_read(): that would need the grant
-- to already be readable to decide whether the grant is readable. Being
-- staff is the whole test, and the row contains no family content.
drop policy if exists "grants staff read" on support_grants;
create policy "grants staff read" on support_grants
  for select using (is_staff());

-- The family's name, so a support view can say "the Wilsons" instead of a
-- uuid. Gated on the grant, unlike the policy above — a name is a fact
-- about a family rather than a message to us, and there is no reason to
-- know it before they ask.
drop policy if exists "families support read" on families;
create policy "families support read" on families
  for select using (support_may_read(id));


-- ======================================================================
-- 0028_free_cap.sql
-- ======================================================================

-- The free cap, enforced where it costs nothing.
--
-- The first version of this checked the cap in keepMemory(), the single
-- place a memory row is created. That is the right *place* — a quote, a
-- note, an answer to a question and a recording are all memories, and only
-- photographs pass an upload ticket that counts anything — but it is the
-- wrong *layer*. It added two queries to every insert, so a parent moving
-- three hundred photographs across paid six hundred extra round trips for a
-- rule that is a single count.
--
-- Here instead, for the same reason family isolation lives in row-level
-- security rather than in a helper somebody could forget to call:
--
--   It cannot be bypassed. Not by a new code path, not by a background job,
--   not by a direct insert from the SQL editor.
--
--   It costs nothing on the hot path. One indexed count inside a trigger
--   that only runs for families who are not paying, rather than two round
--   trips per row for everybody.
--
-- The application still asks lib/billing/standing.ts before an upload
-- starts. That is not the enforcement — it is the sentence a family reads,
-- which a raised exception cannot be. Database refuses; app explains.
--
-- Deliberately not a check constraint: the rule depends on another table.

/**
 * How many memories a family may keep without paying.
 *
 * Mirrors FREE_MEMORIES in lib/billing/free.ts, and tests/free.test.ts fails
 * if the two disagree. A number in two places is a number that drifts, and
 * the alternative — reading it from the application at insert time — is the
 * round trip this migration exists to remove.
 */
create or replace function free_memory_cap()
returns integer language sql immutable set search_path = '' as $$ select 100 $$;

/**
 * Whether a family is paying.
 *
 * past_due counts. A card that failed on Tuesday is a card problem, and
 * refusing a parent's photographs over one turns a billing retry into a
 * cancellation. Mirrors tierOf() in lib/billing/free.ts.
 */
create or replace function family_is_paying(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from families f
      where f.id = fid
        and (f.membership_state in ('active', 'past_due')
             or (f.paid_until is not null and f.paid_until > now()))) $$;

create or replace function refuse_past_free_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare kept integer;
begin
  -- The common case, and it costs one indexed lookup on families.
  if family_is_paying(new.family_id) then
    return new;
  end if;

  select count(*) into kept from memories m where m.family_id = new.family_id;
  if kept >= free_memory_cap() then
    -- The application catches this and shows its own sentence. The text
    -- here is for a developer reading a log, not for a parent.
    raise exception 'free archive is full (% of %)', kept, free_memory_cap()
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists memories_free_cap_trg on memories;
create trigger memories_free_cap_trg
  before insert on memories
  for each row execute function refuse_past_free_cap();

-- The count above is per family and runs on every insert for a free family.
-- Without this it is a sequential scan of every memory in the database.
create index if not exists memories_family_idx on memories(family_id);
