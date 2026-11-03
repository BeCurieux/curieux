-- Schema: every table in SPEC.md → Data model that the foundation migration
-- didn't create, row level security, the entitlement resolution functions,
-- and the five products with their prices.
--
-- How the spec's RLS rule is applied (and where it is deliberately narrower):
--
--   "Users read and write only their own rows." They read their own rows
--   everywhere. They write only the rows that are theirs to author:
--   lesson_progress, calc_runs and verdicts (and their profile, from the
--   foundation migration). Orders, entitlements and email_events are their
--   rows too, but writing them would let anyone grant herself the course, so
--   only the server (service role: Stripe webhook, admin actions, cron)
--   writes those. leads belong to nobody yet, so only the server writes them.
--
--   "Admin reads everything." Every table has an admins-read-all policy via
--   public.is_admin(). Admin changes (refunds, reviews) go through server
--   actions with the service role after an is_admin() check.
--
--   "Lesson and module content is readable by anyone, but video and download
--   URLs are served through a signed route that checks entitlement." Modules,
--   lessons, lesson_assets and calculators are readable by anyone, except the
--   columns that would unlock content: lessons.video_id, lessons.script_md
--   and lesson_assets.storage_path. Column grants keep those out of the API;
--   lesson_content() hands them over only after the entitlement check.

-- ---------------------------------------------------------------------------
-- Types

-- What a person can reach. Declaration order is the tier order, so max() and
-- >= compare tiers directly: free < module0 < course < founding.
create type public.access_tier as enum ('free', 'module0', 'course', 'founding');

-- What can be bought or granted: the four tiers plus the benchmark pack,
-- which is a separate yes/no entitlement, not a rung on the ladder.
create type public.product_tier as enum ('free', 'module0', 'course', 'founding', 'benchmark_pack');

create type public.verdict_colour as enum ('green', 'amber', 'red');

-- ---------------------------------------------------------------------------
-- products: one per tier. Prices in cents. No tax columns, by design: no GST
-- is charged or itemised anywhere (SPEC.md → Non-negotiables).

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  tier public.product_tier not null unique,
  price_aud_cents integer not null check (price_aud_cents >= 0),
  -- Null until the founder sets the USD prices; checkout must refuse USD
  -- for a product with no USD price rather than guess one.
  price_usd_cents integer check (price_usd_cents >= 0),
  stripe_price_id_aud text,
  stripe_price_id_usd text,
  active boolean not null default true,
  -- Only the founding cohort is limited. The check makes the database refuse
  -- a 31st sale even if every other guard fails.
  places_total integer check (places_total > 0),
  places_sold integer not null default 0 check (places_sold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_places_within_total check (places_total is null or places_sold <= places_total)
);

-- ---------------------------------------------------------------------------
-- orders: one row per completed checkout. Written only by the webhook.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Kept (user set null) if she deletes her account: it's a sales record.
  user_id uuid references auth.users (id) on delete set null,
  product_id uuid not null references public.products (id),
  -- The webhook is idempotent on this.
  stripe_session_id text not null unique,
  stripe_payment_intent text unique,
  -- What she paid in total, bump included, in the currency charged.
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency in ('aud', 'usd')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  refunded_at timestamptz,
  -- The benchmark pack, when she ticked the order bump on Module 0.
  bump_product_id uuid references public.products (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_refund_consistent check ((status = 'refunded') = (refunded_at is not null))
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_product_id_idx on public.orders (product_id);

-- ---------------------------------------------------------------------------
-- entitlements: the source of truth for access. A refund sets revoked_at;
-- rows are never deleted, so access history stays readable.

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier public.product_tier not null,
  -- Null for a grant made by hand (admin) rather than by a purchase.
  granted_by_order_id uuid references public.orders (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A webhook retry can't grant the same thing twice from one order.
  constraint entitlements_one_per_order_tier unique (granted_by_order_id, tier)
);

create index entitlements_user_id_idx on public.entitlements (user_id);
-- Nor can a hand grant be duplicated while it's live.
create unique index entitlements_one_manual_grant
  on public.entitlements (user_id, tier)
  where granted_by_order_id is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Course content. Loaded from /content by the seed script (build step 3).

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  number integer not null unique check (number >= 0),
  title text not null,
  summary text not null default '',
  -- The spec's "order". Not named order: that's a reserved word in SQL.
  position integer not null,
  -- The "Library" module of benchmark sheets and templates (SPEC.md →
  -- Content loading) is hidden from the module list.
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- As the course numbers them: "0.1", "0.8", "2.3".
  number text not null check (number ~ '^[0-9]+\.[0-9]+$'),
  title text not null,
  summary text not null default '',
  video_provider text check (video_provider in ('bunny', 'youtube')),
  video_id text,
  duration_sec integer check (duration_sec >= 0),
  -- Founding isn't a lesson tier: founding gets everything course gets.
  min_tier public.access_tier not null default 'course' check (min_tier <> 'founding'),
  position integer not null,
  script_md text not null default '',
  -- Worked examples A, B and C are ordinary lessons the UI labels.
  example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_slug_per_module unique (module_id, slug),
  constraint lessons_number_unique unique (number),
  constraint lessons_video_complete check ((video_provider is null) = (video_id is null))
);

create index lessons_module_id_idx on public.lessons (module_id);

create table public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  label text not null,
  -- A path in the private lesson-assets bucket. Served by /api/assets/[id]
  -- as a short-lived signed URL after the entitlement check.
  storage_path text not null,
  kind text not null check (kind in ('sheet', 'pdf', 'template')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_assets_lesson_id_idx on public.lesson_assets (lesson_id);

create table public.calculators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  module_id uuid references public.modules (id) on delete set null,
  min_tier public.access_tier not null default 'course' check (min_tier <> 'founding'),
  -- Drives the form. Formulas are code (/lib/calc), never stored here.
  schema_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Her own work

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_once unique (user_id, lesson_id)
);

create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);

create table public.calc_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calculator_slug text not null references public.calculators (slug) on update cascade on delete cascade,
  -- Money is stored as she entered it, in this currency (SPEC.md →
  -- Calculator specs). Percentages are whole numbers inside inputs_json.
  currency text not null default 'AUD' check (currency in ('AUD', 'USD')),
  inputs_json jsonb not null,
  outputs_json jsonb not null,
  verdict public.verdict_colour,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Latest shown on return": her newest run of each calculator.
create index calc_runs_latest_idx on public.calc_runs (user_id, calculator_slug, created_at desc);

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_name text not null check (char_length(product_name) between 1 and 200),
  verdict public.verdict_colour not null,
  reasons_json jsonb not null default '[]'::jsonb,
  -- Set when a founding buyer sends it for her written review.
  submitted_at timestamptz,
  -- The founder's review. Written only by the server (admin action).
  reviewed_at timestamptz,
  review_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verdicts_review_consistent check ((reviewed_at is null) = (review_md is null)),
  constraint verdicts_review_after_submit check (reviewed_at is null or submitted_at is not null)
);

create index verdicts_user_id_idx on public.verdicts (user_id);
create index verdicts_review_queue_idx on public.verdicts (submitted_at) where submitted_at is not null and reviewed_at is null;

-- ---------------------------------------------------------------------------
-- leads: free-tier captures before sign-up. One row per address.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email like '%_@_%'),
  -- Where she first came from. A ManyChat keyword sets 'keyword' via UTM.
  source text not null check (source in ('product_check', 'hype_check', 'waitlist', 'keyword')),
  first_seen timestamptz not null default now(),
  converted_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_converted_user_id_idx on public.leads (converted_user_id);

-- ---------------------------------------------------------------------------
-- email_events: every send is recorded here first, so a retried webhook or
-- cron run never sends twice (SPEC.md → Email). A row means "claimed";
-- sent_at and provider_id are filled in once the provider accepts it.

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  lead_email text check (lead_email is null or lead_email = lower(lead_email)),
  -- Which email, made unique per occasion where it can recur, e.g.
  -- 'onboarding_2', 'nudge_5', 'receipt:<order id>', 'refund:<order id>'.
  template text not null,
  sent_at timestamptz,
  provider_id text,
  -- The one recipient, whichever kind, for the uniqueness rule below.
  recipient text not null generated always as (coalesce(user_id::text, lead_email)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_events_one_recipient check ((user_id is null) <> (lead_email is null)),
  constraint email_events_once unique (recipient, template)
);

-- ---------------------------------------------------------------------------
-- updated_at on every new table

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'orders', 'entitlements', 'modules', 'lessons', 'lesson_assets',
    'calculators', 'lesson_progress', 'calc_runs', 'verdicts', 'leads', 'email_events'
  ] loop
    execute format(
      'create trigger %1$I before update on public.%2$I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Entitlement resolution (SPEC.md → Data model)
--
-- Effective tier = the highest non-revoked entitlement. Anyone signed in has
-- at least 'free' (the free tier is "email required", and every account has
-- one). The benchmark pack is a separate yes/no: her own pack entitlement,
-- or course or founding, which include it.
--
-- tier_of() and has_benchmark_pack_of() answer for any user and are for the
-- server only (webhook, signed asset route, admin). my_tier(),
-- my_benchmark_pack() and can_access() answer only for the caller.

create function public.tier_of(p_user uuid) returns public.access_tier
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user is null then null
    else coalesce(
      (select max(e.tier::text::public.access_tier)
         from public.entitlements e
        where e.user_id = p_user
          and e.revoked_at is null
          and e.tier <> 'benchmark_pack'),
      'free'::public.access_tier)
  end;
$$;

create function public.has_benchmark_pack_of(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and (
    exists (
      select 1 from public.entitlements e
       where e.user_id = p_user and e.revoked_at is null and e.tier = 'benchmark_pack')
    or public.tier_of(p_user) >= 'course'
  );
$$;

revoke all on function public.tier_of(uuid) from public, anon, authenticated;
revoke all on function public.has_benchmark_pack_of(uuid) from public, anon, authenticated;
grant execute on function public.tier_of(uuid) to service_role;
grant execute on function public.has_benchmark_pack_of(uuid) to service_role;

create function public.my_tier() returns public.access_tier
language sql
stable
security definer
set search_path = ''
as $$
  select public.tier_of((select auth.uid()));
$$;

create function public.my_benchmark_pack() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_benchmark_pack_of((select auth.uid()));
$$;

-- Whether the caller may open something needing p_min. False when signed out.
create function public.can_access(p_min public.access_tier) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_tier() >= p_min, false);
$$;

revoke all on function public.my_tier() from public, anon;
revoke all on function public.my_benchmark_pack() from public, anon;
revoke all on function public.can_access(public.access_tier) from public, anon;
grant execute on function public.my_tier() to authenticated;
grant execute on function public.my_benchmark_pack() to authenticated;
grant execute on function public.can_access(public.access_tier) to authenticated;

-- The gated part of a lesson: the video and the script. Nothing comes back
-- unless the caller's tier reaches the lesson's min_tier, so the lesson page
-- (server-rendered) can't show a locked lesson even by mistake.
create function public.lesson_content(p_lesson uuid)
returns table (video_provider text, video_id text, duration_sec integer, script_md text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.video_provider, l.video_id, l.duration_sec, l.script_md
    from public.lessons l
   where l.id = p_lesson
     and public.can_access(l.min_tier);
$$;

revoke all on function public.lesson_content(uuid) from public, anon;
grant execute on function public.lesson_content(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Leads become customers: link a lead to the account with the same email,
-- whichever comes first.

create function public.link_lead_on_profile() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.leads set converted_user_id = new.user_id
   where email = lower(new.email) and converted_user_id is null;
  return new;
end;
$$;

create trigger profiles_link_lead after insert on public.profiles
  for each row execute function public.link_lead_on_profile();

create function public.link_new_lead() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.converted_user_id is null then
    select p.user_id into new.converted_user_id
      from public.profiles p where lower(p.email) = new.email limit 1;
  end if;
  return new;
end;
$$;

create trigger leads_link_user before insert on public.leads
  for each row execute function public.link_new_lead();

revoke all on function public.link_lead_on_profile() from public, anon, authenticated;
revoke all on function public.link_new_lead() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.entitlements enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_assets enable row level security;
alter table public.calculators enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.calc_runs enable row level security;
alter table public.verdicts enable row level security;
alter table public.leads enable row level security;
alter table public.email_events enable row level security;

-- Server-only writes: take the API's write privileges away entirely, on top
-- of there being no write policies. Belt and braces for the tables that
-- decide access and money.
revoke insert, update, delete, truncate on
  public.products, public.orders, public.entitlements, public.modules, public.lessons,
  public.lesson_assets, public.calculators, public.leads, public.email_events
  from anon, authenticated;

-- products: the pricing page reads the active ones, signed in or not.
create policy "products: anyone reads active" on public.products
  for select to anon, authenticated
  using (active);
create policy "products: admins read all" on public.products
  for select to authenticated
  using ((select public.is_admin()));

-- orders and entitlements: her own, read-only.
create policy "orders: read own" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "orders: admins read all" on public.orders
  for select to authenticated
  using ((select public.is_admin()));

create policy "entitlements: read own" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "entitlements: admins read all" on public.entitlements
  for select to authenticated
  using ((select public.is_admin()));

-- Content: anyone reads it, minus the columns that unlock it.
create policy "modules: anyone reads" on public.modules
  for select to anon, authenticated using (true);
create policy "lessons: anyone reads" on public.lessons
  for select to anon, authenticated using (true);
create policy "lesson_assets: anyone reads" on public.lesson_assets
  for select to anon, authenticated using (true);
create policy "calculators: anyone reads" on public.calculators
  for select to anon, authenticated using (true);

revoke select on public.lessons from anon, authenticated;
grant select (id, module_id, slug, number, title, summary, video_provider, duration_sec,
              min_tier, position, example, created_at, updated_at)
  on public.lessons to anon, authenticated;
revoke select on public.lesson_assets from anon, authenticated;
grant select (id, lesson_id, label, kind, created_at, updated_at)
  on public.lesson_assets to anon, authenticated;

-- lesson_progress: hers to mark and unmark, only on lessons she can open.
create policy "lesson_progress: read own" on public.lesson_progress
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "lesson_progress: admins read all" on public.lesson_progress
  for select to authenticated
  using ((select public.is_admin()));
create policy "lesson_progress: mark own, on lessons she can open" on public.lesson_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.lessons l
                 where l.id = lesson_id and public.can_access(l.min_tier))
  );
create policy "lesson_progress: unmark own" on public.lesson_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.lesson_progress from anon, authenticated;

-- calc_runs: hers, on calculators her tier reaches. Runs are a record, so
-- she adds and deletes them but doesn't edit one in place.
create policy "calc_runs: read own" on public.calc_runs
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "calc_runs: admins read all" on public.calc_runs
  for select to authenticated
  using ((select public.is_admin()));
create policy "calc_runs: save own, on calculators she can use" on public.calc_runs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.calculators c
                 where c.slug = calculator_slug and public.can_access(c.min_tier))
  );
create policy "calc_runs: delete own" on public.calc_runs
  for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.calc_runs from anon, authenticated;

-- verdicts: /verdict is Module 0 and above. She writes her verdict and can
-- send it for review; the review itself is the founder's (server only), and
-- once she has sent it, it's fixed so the founder reviews what was sent.
create policy "verdicts: read own" on public.verdicts
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "verdicts: admins read all" on public.verdicts
  for select to authenticated
  using ((select public.is_admin()));
create policy "verdicts: write own, module0 and above" on public.verdicts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access('module0'));
create policy "verdicts: edit own until sent for review" on public.verdicts
  for update to authenticated
  using (user_id = (select auth.uid()) and submitted_at is null)
  with check (user_id = (select auth.uid()) and public.can_access('module0'));
create policy "verdicts: delete own until sent for review" on public.verdicts
  for delete to authenticated
  using (user_id = (select auth.uid()) and submitted_at is null);

revoke insert, update on public.verdicts from anon, authenticated;
grant insert (id, product_name, verdict, reasons_json, submitted_at) on public.verdicts to authenticated;
grant update (product_name, verdict, reasons_json, submitted_at) on public.verdicts to authenticated;

-- Sending for review is a founding-cohort benefit (SPEC.md → Access tiers).
create function public.verdicts_guard_submit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The server (service role) and SQL may do anything; this guards the API.
  if (select auth.uid()) is null then return new; end if;
  if new.submitted_at is not null
     and (tg_op = 'INSERT' or old.submitted_at is null)
     and not public.can_access('founding') then
    raise exception 'Only founding cohort members can send a verdict for review'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.verdicts_guard_submit() from public, anon, authenticated;

create trigger verdicts_guard_submit before insert or update on public.verdicts
  for each row execute function public.verdicts_guard_submit();

-- leads and email_events: nobody but the server and admins.
create policy "leads: admins read all" on public.leads
  for select to authenticated
  using ((select public.is_admin()));
create policy "email_events: admins read all" on public.email_events
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- The five products (SPEC.md → Access tiers). AUD prices from the spec.
-- USD prices aren't in the spec, so they stay null until the founder sets
-- them (README.md → Build progress). Stripe price ids arrive in step 5.

insert into public.products (slug, name, tier, price_aud_cents, places_total) values
  ('product-check', 'Free Product Check', 'free', 0, null),
  ('module-0', 'Module 0', 'module0', 4900, null),
  ('course', 'Full course', 'course', 25000, null),
  ('founding', 'Founding cohort', 'founding', 34900, 30),
  ('benchmark-pack', 'Benchmark pack', 'benchmark_pack', 2900, null);
