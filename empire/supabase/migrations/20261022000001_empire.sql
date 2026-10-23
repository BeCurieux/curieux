-- Empire Studio: every table, its tenancy rules and its row level security.
--
-- The boundary is the database, not the app. Each customer row carries
-- user_id; composite foreign keys make it impossible for a product,
-- generation or task to point at another customer's profile; and RLS only
-- ever shows a signed-in user her own rows. docs/DATA_MODEL.md explains it.
--
-- What customers can write: their profiles, products, launch tasks, and
-- generations they make by editing or restoring. What they can only read:
-- profile history, entitlements, usage. What they cannot see at all:
-- purchases (the payment record) and analytics events. The server writes
-- those with the service role after checking who is asking.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) between 1 and 80),
  website_url text check (website_url is null or char_length(website_url) <= 200),
  category text not null check (char_length(category) <= 80),
  audience text not null check (char_length(audience) <= 600),
  products_summary text not null check (char_length(products_summary) <= 800),
  personality text not null default '' check (char_length(personality) <= 400),
  visual_style text not null default '' check (char_length(visual_style) <= 400),
  colours text not null default '' check (char_length(colours) <= 200),
  market text not null check (char_length(market) <= 80),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  goal text not null default '' check (char_length(goal) <= 400),
  stage text not null check (stage in ('idea', 'prelaunch', 'launched', 'growing')),
  fulfilment text not null check (fulfilment in ('physical', 'digital', 'both')),
  verified_claims text[] not null default '{}',
  prohibited_claims text[] not null default '{}',
  logo_path text,
  brand jsonb,
  version integer not null default 1,
  -- Why the latest save happened; copied into profile_versions by trigger.
  last_note text not null default 'Created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index business_profiles_user_idx on public.business_profiles (user_id);

create table public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  user_id uuid not null,
  version integer not null,
  facts jsonb not null,
  brand jsonb,
  note text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, version),
  foreign key (profile_id, user_id) references public.business_profiles (id, user_id) on delete cascade
);

-- A hard ceiling per account, whatever the plan. Plans allow fewer; the app
-- checks those. This stops anyone scripting the API around the app.
create function public.limit_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.business_profiles where user_id = new.user_id) >= 5 then
    raise exception 'profile limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger business_profiles_limit before insert on public.business_profiles
for each row execute function public.limit_profiles();

-- Every save bumps the version; nobody can set it by hand.
create function public.bump_profile_version() returns trigger
language plpgsql set search_path = public as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.user_id := old.user_id;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger business_profiles_bump before update on public.business_profiles
for each row execute function public.bump_profile_version();

create function public.snapshot_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_versions (profile_id, user_id, version, facts, brand, note)
  values (
    new.id, new.user_id, new.version,
    jsonb_build_object(
      'brandName', new.brand_name, 'websiteUrl', new.website_url, 'category', new.category,
      'audience', new.audience, 'productsSummary', new.products_summary,
      'personality', new.personality, 'visualStyle', new.visual_style, 'colours', new.colours,
      'market', new.market, 'currency', new.currency, 'goal', new.goal, 'stage', new.stage,
      'fulfilment', new.fulfilment, 'verifiedClaims', to_jsonb(new.verified_claims),
      'prohibitedClaims', to_jsonb(new.prohibited_claims)
    ),
    new.brand,
    left(new.last_note, 200)
  );
  return new;
end;
$$;

create trigger business_profiles_snapshot after insert or update on public.business_profiles
for each row execute function public.snapshot_profile();

-- ------------------------------------------------------------------ products

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  profile_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default '' check (char_length(category) <= 80),
  materials text not null default '' check (char_length(materials) <= 800),
  dimensions text not null default '' check (char_length(dimensions) <= 300),
  colour_options text not null default '' check (char_length(colour_options) <= 300),
  benefits text not null default '' check (char_length(benefits) <= 1000),
  intended_use text not null default '' check (char_length(intended_use) <= 600),
  customer_problem text not null default '' check (char_length(customer_problem) <= 600),
  price numeric(12, 2) check (price is null or price >= 0),
  care_instructions text not null default '' check (char_length(care_instructions) <= 600),
  shipping_info text not null default '' check (char_length(shipping_info) <= 600),
  verified_claims text[] not null default '{}',
  image_notes text not null default '' check (char_length(image_notes) <= 800),
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (profile_id, user_id) references public.business_profiles (id, user_id) on delete cascade
);

create index products_profile_idx on public.products (profile_id);

-- Customers attach only photos stored under their own folder.
create function public.check_product_images() returns trigger
language plpgsql set search_path = public as $$
declare
  p text;
begin
  if array_length(new.image_paths, 1) > 8 then
    raise exception 'too many images' using errcode = 'check_violation';
  end if;
  foreach p in array new.image_paths loop
    if split_part(p, '/', 1) <> new.user_id::text then
      raise exception 'image path outside owner folder' using errcode = 'check_violation';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_images before insert or update on public.products
for each row execute function public.check_product_images();

-- --------------------------------------------------------------- generations

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  profile_id uuid not null,
  product_id uuid,
  module text not null check (module in (
    'brand_blueprint', 'theme_brief', 'theme_prompts', 'homepage_copy',
    'product_listing', 'image_briefs', 'email_sequence', 'social_content'
  )),
  version integer not null default 0,
  status text not null check (status in ('succeeded', 'failed')),
  source text not null check (source in ('ai', 'mock', 'edit', 'restore')),
  section text,
  input_snapshot jsonb not null default '{}',
  output jsonb,
  warnings text[] not null default '{}',
  error text,
  model_version text,
  profile_version integer not null,
  created_at timestamptz not null default now(),
  foreign key (profile_id, user_id) references public.business_profiles (id, user_id) on delete cascade,
  foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  check (status = 'failed' or output is not null),
  check (octet_length(output::text) <= 200000)
);

create unique index generations_asset_version on public.generations (
  profile_id, module, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), version
);
create index generations_user_created on public.generations (user_id, created_at desc);

-- Versions are assigned here, one asset at a time, so two saves can't
-- both become version 3.
create function public.assign_generation_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.profile_id::text || new.module || coalesce(new.product_id::text, ''))
  );
  select coalesce(max(version), 0) + 1 into new.version
  from public.generations
  where profile_id = new.profile_id
    and module = new.module
    and product_id is not distinct from new.product_id;
  new.created_at := now();
  return new;
end;
$$;

create trigger generations_version before insert on public.generations
for each row execute function public.assign_generation_version();

-- -------------------------------------------------------------- launch tasks

create table public.launch_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  profile_id uuid not null,
  task_key text not null check (char_length(task_key) <= 80),
  category text not null check (char_length(category) <= 80),
  label text not null check (char_length(label) <= 200),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete', 'not_applicable')),
  notes text not null default '' check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  unique (profile_id, task_key),
  foreign key (profile_id, user_id) references public.business_profiles (id, user_id) on delete cascade
);

-- ---------------------------------------------------- payments and access

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gumroad')),
  external_purchase_id text not null,
  -- 'launch_pack' (the software) or 'library:<slug>' (an existing Her Little
  -- Empire download, content/catalogue.json). Earlier purchases keep working.
  product_type text not null check (product_type = 'launch_pack' or product_type ~ '^library:[a-z0-9-]{1,60}$'),
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  amount_cents integer,
  currency text,
  -- Gumroad licence key, kept so the daily recheck can re-verify the sale
  -- (and catch refunds). Service role only, like the rest of this table.
  license_key text,
  purchased_at timestamptz not null,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, external_purchase_id)
);

create index purchases_email_idx on public.purchases (lower(email)) where user_id is null;

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'launch_pack' (the software) or 'library:<slug>' (an existing Her Little
  -- Empire download, content/catalogue.json). Earlier purchases keep working.
  product_type text not null check (product_type = 'launch_pack' or product_type ~ '^library:[a-z0-9-]{1,60}$'),
  payment_provider text not null check (payment_provider in ('gumroad', 'manual')),
  external_purchase_id text not null,
  status text not null check (status in ('active', 'refunded', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_provider, external_purchase_id)
);

create index entitlements_user_idx on public.entitlements (user_id);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid references public.generations (id) on delete set null,
  module text not null,
  operation text not null check (operation in ('generate', 'generate_failed')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index usage_ledger_user_created on public.usage_ledger (user_id, created_at desc);
create index usage_ledger_created on public.usage_ledger (created_at desc);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) <= 60),
  user_id uuid references auth.users (id) on delete set null,
  anonymous_id text check (char_length(anonymous_id) <= 64),
  props jsonb not null default '{}' check (octet_length(props::text) <= 2000),
  created_at timestamptz not null default now()
);

create index analytics_events_name_created on public.analytics_events (name, created_at desc);

-- --------------------------------------------------- row level security

alter table public.business_profiles enable row level security;
alter table public.profile_versions enable row level security;
alter table public.products enable row level security;
alter table public.generations enable row level security;
alter table public.launch_tasks enable row level security;
alter table public.purchases enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.analytics_events enable row level security;

revoke all on public.business_profiles, public.profile_versions, public.products,
  public.generations, public.launch_tasks, public.purchases, public.entitlements,
  public.usage_ledger, public.analytics_events from anon, authenticated;

grant select, insert, update, delete on public.business_profiles to authenticated;
grant select on public.profile_versions to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert on public.generations to authenticated;
grant select, insert, update on public.launch_tasks to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.usage_ledger to authenticated;
-- purchases and analytics_events: service role only.

create policy "own profiles" on public.business_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own profile history" on public.profile_versions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "own products" on public.products
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "read own generations" on public.generations
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Customers save their own edits and restores. Model-written versions come
-- from the server, which meters and charges for them.
create policy "save own edits" on public.generations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and source in ('edit', 'restore')
    and status = 'succeeded'
  );

create policy "own tasks" on public.launch_tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "read own entitlements" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "read own usage" on public.usage_ledger
  for select to authenticated
  using (user_id = (select auth.uid()));
