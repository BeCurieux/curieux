-- Does the anon key actually see only what it should?
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f src/lib/publish/rls-check.sql
--
-- Run this after schema.sql, against the project you are about to publish from.
-- It is the one thing no test in the repo could prove, because it is a property
-- of the database rather than of the code — and the thing it protects is the
-- Genome, which is a model's reading of a merchant's catalogue, reads like page
-- copy, and is not page copy.
--
-- Everything happens inside a transaction that rolls back, including the probe
-- rows, so this is safe to run against a live project. It raises on the first
-- failure rather than printing a report nobody reads to the end.
--
-- Why this replaced a by-hand checklist: the by-hand version asked for
-- "permission denied" on four tables and was wrong about all four. Supabase
-- grants `anon` table-level privileges on `public` by default and relies on RLS
-- for row protection, so a denied read comes back as *zero rows*, not an error
-- — and two of the four tables are supposed to return rows, because schema.sql
-- deliberately gives them read policies. An operator following the old list
-- would have "fixed" a database that was already correct.

begin;

do $$
declare
  store_id  uuid;
  pub_id    uuid;
  draft_id  uuid;
  pub_ver   uuid;
  draft_ver uuid;
  n         bigint;
  txt       text;
begin
  -- ------------------------------------------------------------- probe rows
  insert into public.stores (store_url, catalogue, genome, ingested_at)
  values ('https://rls-probe.invalid',
          '{"products":[]}'::jsonb,
          '{"rls_probe_secret":"if you can read this from the anon key, stop"}'::jsonb,
          now())
  returning id into store_id;

  insert into public.shops (store_id, slug) values (store_id, 'rls-probe-published')
  returning id into pub_id;
  insert into public.shops (store_id, slug) values (store_id, 'rls-probe-draft')
  returning id into draft_id;

  insert into public.shop_versions (shop_id, version, config, prompt, audience)
  values (pub_id, 1, '{"blocks":[]}'::jsonb, 'rls probe published prompt', 'probe')
  returning id into pub_ver;
  insert into public.shop_versions (shop_id, version, config, prompt, audience)
  values (draft_id, 1, '{"blocks":[]}'::jsonb, 'rls probe DRAFT prompt', 'probe')
  returning id into draft_ver;

  update public.shops set current_version_id = pub_ver where id = pub_id;

  insert into public.shop_events (shop_id, version_id, session_id, type)
  values (pub_id, pub_ver, 'rls-probe', 'view');

  -- ------------------------------------------------------- read, as the public
  set local role anon;

  -- The Genome. This is the assertion the file exists for.
  select count(*) into n from public.stores;
  if n <> 0 then
    raise exception 'anon can read public.stores (% rows). The Genome is exposed.', n;
  end if;

  -- Same table by the back door: a view that joins it. `published_shops` is
  -- security_invoker precisely so this stays empty.
  select count(*) into n from public.published_shops;
  if n <> 0 then
    raise exception 'anon can read public.published_shops (% rows), which joins stores.', n;
  end if;

  -- Funnel events are the merchant's, not the public's.
  select count(*) into n from public.shop_events;
  if n <> 0 then
    raise exception 'anon can read public.shop_events (% rows).', n;
  end if;

  select count(*) into n from public.shop_funnel('rls-probe-published');
  if n <> 0 then
    raise exception 'anon can read the funnel through shop_funnel() (% rows).', n;
  end if;

  -- Unpublished work stays unpublished. A draft shop has no current version, so
  -- neither it nor its prompt may surface.
  select count(*) into n from public.shops where slug = 'rls-probe-draft';
  if n <> 0 then
    raise exception 'anon can see an unpublished shop.';
  end if;

  select count(*) into n from public.shop_versions where id = draft_ver;
  if n <> 0 then
    raise exception 'anon can read an unpublished shop version, including its prompt.';
  end if;

  -- The one public read path has to work, or the check above is only proving
  -- that everything is broken.
  select count(*) into n from public.get_published_shop('rls-probe-published');
  if n <> 1 then
    raise exception 'get_published_shop returned % rows for a published slug; expected 1.', n;
  end if;

  -- ...and must not serve a draft.
  select count(*) into n from public.get_published_shop('rls-probe-draft');
  if n <> 0 then
    raise exception 'get_published_shop served an unpublished shop.';
  end if;

  -- The allowlist is the function's column list. If `genome` ever joins it this
  -- fails to compile rather than leaking quietly, but check the shape anyway.
  select string_agg(a.attname, ',' order by a.attnum) into txt
  from pg_proc p
  join unnest(p.proallargtypes) with ordinality as t(typ, ord) on true
  join lateral (
    select p.proargnames[t.ord] as attname, t.ord as attnum
  ) a on true
  where p.proname = 'get_published_shop' and p.pronamespace = 'public'::regnamespace;
  if txt like '%genome%' then
    raise exception 'get_published_shop returns a genome column: %', txt;
  end if;

  -- ------------------------------------------------------ write, as the public
  -- Grants exist (Supabase gives anon ALL on public tables); RLS is what stops
  -- these. Inserts raise; updates and deletes report zero rows rather than
  -- failing, which is correct and easy to misread by eye — hence the counts.
  begin
    insert into public.shop_events (shop_id, version_id, session_id, type)
    values (pub_id, pub_ver, 'forged', 'view');
    raise exception 'anon can forge a funnel event.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.shops (store_id, slug) values (store_id, 'rls-probe-hijack');
    raise exception 'anon can create a shop.';
  exception
    when insufficient_privilege then null;
  end;

  update public.shops set plan = 'pro' where slug = 'rls-probe-published';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'anon updated % shop row(s).', n;
  end if;

  update public.stores set catalogue = '{}'::jsonb;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'anon updated % store row(s).', n;
  end if;

  delete from public.shop_versions;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'anon deleted % version row(s).', n;
  end if;

  reset role;
  raise notice 'RLS check passed: the anon key reads published shops and nothing else, and writes nothing.';
end $$;

rollback;
