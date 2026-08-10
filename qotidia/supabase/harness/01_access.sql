-- Does the archive actually keep families apart?
--
-- Every claim this codebase makes about privacy ends up as a row-level
-- security policy, and until this file existed not one of them had been
-- executed. The application tests check that our queries *ask* the right
-- questions; these check that the database would refuse the wrong answer
-- even if a query forgot to.
--
-- That distinction is the whole point. A missing `.eq("family_id", …)` in
-- one screen is a bug. The same omission with no policy behind it is one
-- family reading another family's child's year.
--
-- Everything runs as `authenticated` with a session claim, because postgres
-- is a superuser and bypasses RLS entirely — a test that forgot to change
-- role would pass no matter what the policies said.

\set ON_ERROR_STOP on

-- ------------------------------------------------------------------ seed

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'mum@wilsons.test'),
  ('22222222-2222-2222-2222-222222222222', 'gran@wilsons.test'),
  ('33333333-3333-3333-3333-333333333333', 'someone@else.test');

insert into families (id, owner_user_id, family_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'The Wilsons'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Someone Else');

insert into family_memberships (family_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'contributor'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'owner');

insert into subjects (id, family_id, subject_type, display_name, date_of_birth) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'child',  'Florence', '2023-02-06'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'family', 'The Wilsons', null),
  ('dddddddd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'child',  'A Stranger', '2022-05-01');

insert into memories (id, family_id, created_by, type, memory_date, contribution_status, visibility) values
  -- The Wilsons'
  ('eeee0000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'photo', '2026-03-01', 'approved', 'family'),
  ('eeee0000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'text',  '2026-03-02', 'approved', 'private'),
  ('eeee0000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'photo', '2026-03-03', 'pending',  'family'),
  -- Someone else's
  ('ffff0000-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'photo', '2026-03-01', 'approved', 'family');

insert into memory_subjects (memory_id, subject_id) values
  ('eeee0000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');

grant all on all tables in schema public to authenticated;

-- --------------------------------------------------------------- helpers

create or replace function harness_become(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
end $$;

create or replace function harness_expect(label text, got anyelement, want anyelement)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', label, want, got;
  end if;
  raise notice 'ok   %', label;
end $$;

-- ---------------------------------------------------- one family's things

set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');

-- The owner of the Wilsons sees their own year: the family-visible approved
-- one, their own private note, and the contribution still awaiting them.
select harness_expect('owner sees their family''s memories',
  (select count(*)::int from memories), 3);

select harness_expect('owner sees nothing of another family',
  (select count(*)::int from memories where family_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);

select harness_expect('owner sees only their own subjects',
  (select count(*)::int from subjects), 2);

-- The other family, from the other side. Asserted in both directions
-- because a policy that leaks one way and not the other still leaks.
select harness_become('33333333-3333-3333-3333-333333333333');
select harness_expect('the other family sees only its own',
  (select count(*)::int from memories), 1);
select harness_expect('and cannot reach the Wilsons at all',
  (select count(*)::int from memories where family_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);

-- ------------------------------------------------------- what a contributor sees

select harness_become('22222222-2222-2222-2222-222222222222');

-- A grandparent sees what has been approved, plus their own contribution
-- while it waits — and not the parent's private note.
select harness_expect('contributor sees approved and their own pending',
  (select count(*)::int from memories), 2);

select harness_expect('contributor cannot read a private note',
  (select count(*)::int from memories where id = 'eeee0000-0000-0000-0000-000000000002'), 0);

reset role;

-- ------------------------------------------ a link may never cross families

-- The worst failure available in this product, and the one the trigger
-- exists for: it is checked here as the service role, because that is the
-- client several background jobs use and RLS does not apply to it at all.
do $$
declare crossed boolean := false;
begin
  begin
    insert into memory_subjects (memory_id, subject_id)
    values ('eeee0000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000003');
    crossed := true;
  exception when others then
    raise notice 'ok   a cross-family link is refused (%)', left(sqlerrm, 60);
  end;
  if crossed then
    raise exception 'FAILED: a memory was linked to another family''s subject';
  end if;
end $$;

-- And the same link within one family is fine, so the trigger is refusing
-- the right thing rather than everything.
insert into memory_subjects (memory_id, subject_id)
values ('eeee0000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002');
select harness_expect('a link inside the family is allowed',
  (select count(*)::int from memory_subjects where memory_id = 'eeee0000-0000-0000-0000-000000000001'), 2);

-- ------------------------------------------------- the archive owns the memory

select harness_expect('memories no longer carry a subject',
  (select count(*)::int from information_schema.columns
    where table_name = 'memories' and column_name = 'subject_id'), 0);

select harness_expect('and every memory has a family',
  (select count(*)::int from information_schema.columns
    where table_name = 'memories' and column_name = 'family_id' and is_nullable = 'NO'), 1);

-- ================================================== the family memory graph
--
-- Four new tables carrying the thing the whole product compounds on: who is
-- who, and what a family has already told us. Every one of them is checked
-- here rather than trusted, because a new table behind row-level security
-- that nobody has tried to read across a family boundary is a table nobody
-- has checked.

reset role;

insert into entities (id, family_id, kind, label) values
  ('11110000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'person', 'Mimi'),
  ('11110000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'person', 'Grandma Sue'),
  ('22220000-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-000000000002', 'person', 'Someone Else''s Nan');

insert into entity_aliases (entity_id, label, key) values
  ('11110000-0000-0000-0000-00000000000a', 'Mimi', 'mimi'),
  ('11110000-0000-0000-0000-00000000000b', 'Grandma Sue', 'grandma sue');

insert into entity_memories (entity_id, memory_id) values
  ('11110000-0000-0000-0000-00000000000a', 'eeee0000-0000-0000-0000-000000000001');

-- ------------------------------------------- a link may never cross families

do $$
declare crossed boolean := false;
begin
  begin
    insert into entity_memories (entity_id, memory_id)
    values ('22220000-0000-0000-0000-00000000000c', 'eeee0000-0000-0000-0000-000000000001');
    crossed := true;
  exception when others then
    raise notice 'ok   an entity cannot be linked to another family''s memory (%)', left(sqlerrm, 60);
  end;
  if crossed then
    raise exception 'FAILED: an entity was linked to another family''s memory';
  end if;
end $$;

-- ------------------------------------------ a merge may never cross families

do $$
declare crossed boolean := false;
begin
  begin
    perform merge_entities(
      '11110000-0000-0000-0000-00000000000a',
      '22220000-0000-0000-0000-00000000000c');
    crossed := true;
  exception when others then
    raise notice 'ok   two families'' entities cannot be merged (%)', left(sqlerrm, 60);
  end;
  if crossed then
    raise exception 'FAILED: entities from two families were merged';
  end if;
end $$;

-- And a merge inside one family works, so the guard refuses the right thing
-- rather than everything.
select merge_entities(
  '11110000-0000-0000-0000-00000000000b',
  '11110000-0000-0000-0000-00000000000a');

select harness_expect('a merge inside the family folds one into the other',
  (select count(*)::int from entities
    where id = '11110000-0000-0000-0000-00000000000a'
      and merged_into = '11110000-0000-0000-0000-00000000000b'), 1);

select harness_expect('and keeps the name the family used',
  (select count(*)::int from entity_aliases
    where entity_id = '11110000-0000-0000-0000-00000000000b' and key = 'mimi'), 1);

select harness_expect('and moves the memories across',
  (select count(*)::int from entity_memories
    where entity_id = '11110000-0000-0000-0000-00000000000b'), 1);

-- ---------------------------------------------- one family's graph, and only

set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');

select harness_expect('owner sees their own entities',
  (select count(*)::int from entities), 2);

select harness_expect('owner sees nothing of another family''s graph',
  (select count(*)::int from entities
    where family_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);

select harness_expect('owner sees their own aliases and no others',
  (select count(*)::int from entity_aliases), 2);

reset role;
insert into entity_resolutions (family_id, pair_key, same) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'x|y', false),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'p|q', true);

set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');

select harness_expect('a family sees only what it has been asked',
  (select count(*)::int from entity_resolutions), 1);

-- The same question can only be answered once, whichever order it arrives in
-- — pairKey() sorts the ids before joining, so this is the database half of
-- that rule.
reset role;
do $$
declare twice boolean := false;
begin
  begin
    insert into entity_resolutions (family_id, pair_key, same)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'x|y', true);
    twice := true;
  exception when unique_violation then
    raise notice 'ok   the same pair cannot be settled twice';
  end;
  if twice then
    raise exception 'FAILED: a pair was settled twice';
  end if;
end $$;

reset role;

-- ================================================================== storage
--
-- The running total is maintained by a trigger, which means it can drift
-- silently — the whole point of a maintained total is that nothing reads the
-- source. So every assertion here ends by recomputing from the assets and
-- checking nothing moved.

reset role;

insert into memories (id, family_id, created_by, type, memory_date, contribution_status, visibility)
values ('eeee0000-0000-0000-0000-00000000aa01', 'aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'photo', '2026-05-01', 'approved', 'family');

insert into media_assets (id, memory_id, storage_path, mime_type, checksum, bytes) values
  ('cafe0000-0000-0000-0000-0000000000a1', 'eeee0000-0000-0000-0000-00000000aa01',
   'demo/a1.jpg', 'image/jpeg', 'sum-a1', 3000000),
  ('cafe0000-0000-0000-0000-0000000000a2', 'eeee0000-0000-0000-0000-00000000aa01',
   'demo/a2.mp4', 'video/mp4', 'sum-a2', 7000000);

select harness_expect('uploading counts towards the family total',
  (select storage_bytes::int from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  10000000);

update media_assets set bytes = 5000000
  where id = 'cafe0000-0000-0000-0000-0000000000a2';
select harness_expect('correcting a size corrects the total',
  (select storage_bytes::int from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  8000000);

delete from media_assets where id = 'cafe0000-0000-0000-0000-0000000000a1';
select harness_expect('deleting a file gives the space back',
  (select storage_bytes::int from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  5000000);

-- Deleting the memory cascades to its assets, and the total has to follow.
-- This is the case a trigger written only for direct deletes gets wrong.
delete from memories where id = 'eeee0000-0000-0000-0000-00000000aa01';
select harness_expect('deleting a memory releases its files too',
  (select storage_bytes::int from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);

-- The other family never moved.
select harness_expect('one family''s uploads never touch another''s total',
  (select storage_bytes::int from families where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0);

-- ==================================================== keeping it after a death
--
-- Succession moves control of an entire archive, so the questions here are
-- not "does it work" but "what can somebody else make it do". The one that
-- matters most is the last: a stranger must not be able to see, or start,
-- anything about a family they were never named in.

reset role;

insert into family_keepers (id, family_id, email, user_id, relationship, named_by)
values ('c0ffee00-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'gran@wilsons.test', '22222222-2222-2222-2222-222222222222', 'her grandmother',
        '11111111-1111-1111-1111-111111111111');

insert into succession_claims (id, family_id, keeper_id, opening, keeper_email, decides_at)
values ('c1a10000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'c0ffee00-0000-0000-0000-000000000001', 'claimed', 'gran@wilsons.test',
        now() + interval '30 days');

set role authenticated;

select harness_become('11111111-1111-1111-1111-111111111111');
select harness_expect('the owner sees who would keep the archive',
  (select count(*)::int from family_keepers), 1);
select harness_expect('and sees that somebody has asked for it',
  (select count(*)::int from succession_claims), 1);

-- The keeper is not a member of this family, and still has to be able to
-- watch the thing they started. A process you cannot see is one you cannot
-- trust, and the alternative is answering it over email.
select harness_become('22222222-2222-2222-2222-222222222222');
select harness_expect('the keeper can see the request they made',
  (select count(*)::int from succession_claims), 1);

-- The other family. Not a member, not named, no business here at all.
select harness_become('33333333-3333-3333-3333-333333333333');
select harness_expect('a stranger sees no keeper',
  (select count(*)::int from family_keepers), 0);
select harness_expect('and no claim',
  (select count(*)::int from succession_claims), 0);

-- Nobody writes a claim from a browser. Opening one has to check things no
-- policy can express — how long ago the keeper was named, whether one is
-- already open — so the table refuses writes outright and the server does
-- it with the service role.
do $$
begin
  begin
    insert into succession_claims (family_id, opening, keeper_email, decides_at)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'claimed', 'someone@else.test', now());
    raise exception 'FAILED: a claim could be written directly from a session';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok   a claim cannot be opened from a browser';
  end;
end $$;

-- And an owner cannot quietly settle one in their own favour by editing the
-- row — refusing goes through the server too, so it gets logged.
select harness_become('11111111-1111-1111-1111-111111111111');
do $$
declare changed int;
begin
  update succession_claims set status = 'refused' where status = 'notice';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'FAILED: a claim was settled by updating the row directly';
  end if;
  raise notice 'ok   a claim cannot be settled by editing it';
end $$;

-- ------------------------------------------------------------- the handover

reset role;

-- Before: the mother owns it, the grandmother contributes.
select harness_expect('before the handover, the owner is the owner',
  (select role::text from family_memberships
    where family_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '11111111-1111-1111-1111-111111111111'), 'owner');

select hand_over_family('aaaaaaaa-0000-0000-0000-000000000001',
                        '22222222-2222-2222-2222-222222222222');

select harness_expect('the keeper becomes the owner',
  (select role::text from family_memberships
    where family_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '22222222-2222-2222-2222-222222222222'), 'owner');

-- The person who died is not erased. Their memberships, and their name on
-- everything they wrote, stay exactly where they are.
select harness_expect('and the previous owner is kept, not removed',
  (select role::text from family_memberships
    where family_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '11111111-1111-1111-1111-111111111111'), 'editor');

select harness_expect('nothing they wrote changed hands',
  (select count(*)::int from memories
    where created_by = '11111111-1111-1111-1111-111111111111'), 2);

select harness_expect('and the family points at its new owner',
  (select owner_user_id from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '22222222-2222-2222-2222-222222222222'::uuid);

-- Running it again must be a no-op rather than an error: the sweep that
-- calls this can be retried, and a job that fails on its second attempt is
-- a job that pages somebody at 3am over nothing.
do $$
begin
  perform hand_over_family('aaaaaaaa-0000-0000-0000-000000000001',
                           '22222222-2222-2222-2222-222222222222');
  raise notice 'ok   handing over twice is not an error';
end $$;

-- And it reverses, which is the whole reason nothing is deleted. A handover
-- that should not have happened is undone by running it the other way.
select hand_over_family('aaaaaaaa-0000-0000-0000-000000000001',
                        '11111111-1111-1111-1111-111111111111');
select harness_expect('a handover made in error can be undone',
  (select owner_user_id from families where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid);
select harness_expect('and there is still exactly one owner',
  (select count(*)::int from family_memberships
    where family_id = 'aaaaaaaa-0000-0000-0000-000000000001' and role = 'owner'), 1);

-- ============================================== a link somebody was sent
--
-- This is the only door in the product that opens without an account, so
-- the questions are all about what is behind it. A token reaches one frozen
-- story. It must not reach the archive, the other family, or a second story
-- — and a token-guessing loop must get nothing.

reset role;

insert into shared_stories (id, family_id, subject_id, token, kind, payload, shared_by, expires_at)
values
  ('5a4e0000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'AAAAAAAAAAAAAAAAAAAAAA', 'found',
   '{"title":"One Saturday in February"}'::jsonb,
   '11111111-1111-1111-1111-111111111111', now() + interval '30 days'),
  ('5a4e0000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000003', 'BBBBBBBBBBBBBBBBBBBBBB', 'found',
   '{"title":"Another family"}'::jsonb,
   '33333333-3333-3333-3333-333333333333', now() + interval '30 days');

-- A recipient has no session at all. This is the anon role, which is what a
-- browser opening the link actually is.
--
-- The claim has to be cleared as well as the role. request.jwt.claim.sub is
-- a session setting and survives `set role` — so without this the
-- "anonymous visitor" is still carrying whichever user the previous block
-- became, and every assertion below passes for the wrong reason. It did:
-- the first run of this reported that a recipient could list the family's
-- shares, which was true only because the recipient was the owner.
select set_config('request.jwt.claim.sub', '', false);
set role anon;

do $$
declare n int;
begin
  select count(*) into n from open_shared_story('AAAAAAAAAAAAAAAAAAAAAA');
  if n <> 1 then raise exception 'FAILED: a valid token returned % rows', n; end if;
  raise notice 'ok   a token opens the story it was made for';
end $$;

do $$
declare n int;
begin
  select count(*) into n from open_shared_story('ZZZZZZZZZZZZZZZZZZZZZZ');
  if n <> 0 then raise exception 'FAILED: an unknown token returned a story'; end if;
  -- Shape-checked before the lookup, so a guessing loop never reaches the
  -- table at all.
  select count(*) into n from open_shared_story('short');
  if n <> 0 then raise exception 'FAILED: a malformed token was looked up'; end if;
  raise notice 'ok   a guessed token gets nothing';
end $$;

-- The link is the *only* thing it reaches. Everything else stays shut.
select harness_expect('a recipient cannot list what has been shared',
  (select count(*)::int from shared_stories), 0);
select harness_expect('a recipient cannot read the archive',
  (select count(*)::int from memories), 0);
select harness_expect('a recipient cannot read any subjects',
  (select count(*)::int from subjects), 0);

-- Nor write a contribution straight into the table. Whether the link is
-- live, and whether it has had too many already, are not things a policy
-- can check — so the table refuses everything and the server does it.
do $$
begin
  begin
    insert into story_contributions (share_id, family_id, said_by, body)
    values ('5a4e0000-0000-0000-0000-000000000001',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Nobody', 'let me in');
    raise exception 'FAILED: a contribution was written directly by an anonymous caller';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'ok   a contribution cannot be written straight into the table';
  end;
end $$;

-- The family sees its own shares and no others.
set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');
select harness_expect('the family sees what it has sent',
  (select count(*)::int from shared_stories), 1);

select harness_become('33333333-3333-3333-3333-333333333333');
select harness_expect('and never what another family has sent',
  (select count(*)::int from shared_stories
    where family_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);

-- Contributions belong to the family they were sent to.
reset role;
insert into story_contributions (share_id, family_id, said_by, body)
values ('5a4e0000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Gran', 'That was the morning we drove to the coast.');

set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');
select harness_expect('the family reads what came back',
  (select count(*)::int from story_contributions), 1);

select harness_become('33333333-3333-3333-3333-333333333333');
select harness_expect('and another family reads none of it',
  (select count(*)::int from story_contributions), 0);

-- ================================================== who the archive asks about
--
-- Every policy above learns who is making the request from one function, so
-- that the identity provider is a thing this codebase depends on in exactly
-- one place. That is only true while it stays true — the next policy anybody
-- writes will reach for auth.uid() out of habit, because that is what every
-- Supabase example on the internet says. These two assertions are what stops
-- the seam being quietly unpicked one policy at a time.

set role authenticated;
select harness_become('11111111-1111-1111-1111-111111111111');

select harness_expect('the archive knows who is asking',
  (select signed_in_user()), '11111111-1111-1111-1111-111111111111'::uuid);

select harness_become('22222222-2222-2222-2222-222222222222');
select harness_expect('and notices when that changes',
  (select signed_in_user()), '22222222-2222-2222-2222-222222222222'::uuid);

reset role;

-- Nobody signed in at all is null, not a blank uuid and not an error. Every
-- policy compares against it, and `something = null` is false — so the
-- failure mode of an unauthenticated request is seeing nothing, which is the
-- right way round.
select set_config('request.jwt.claim.sub', '', false);
select harness_expect('and nobody is nobody, rather than an error',
  (select signed_in_user()), null::uuid);

do $$
declare stragglers text;
begin
  select string_agg(what, ', ') into stragglers from (
    select 'function ' || p.proname as what
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname <> 'signed_in_user'
       and coalesce(p.prosrc, '') like '%auth.uid()%'
    union all
    select 'policy "' || policyname || '" on ' || schemaname || '.' || tablename
      from pg_policies
     where schemaname in ('public', 'storage')
       and coalesce(qual, '') || coalesce(with_check, '') like '%uid()%'
  ) s;

  if stragglers is not null then
    raise exception 'FAILED: these still ask Supabase directly instead of signed_in_user() — %', stragglers;
  end if;
  raise notice 'ok   nothing but signed_in_user() asks Supabase who the user is';
end $$;

-- And the maintained total agrees with the source of truth.
do $$
declare before bigint; after bigint;
begin
  select sum(storage_bytes) into before from families;
  perform recount_storage();
  select sum(storage_bytes) into after from families;
  if before is distinct from after then
    raise exception 'FAILED: the running total had drifted (% vs %)', before, after;
  end if;
  raise notice 'ok   the running total agrees with a recount';
end $$;
