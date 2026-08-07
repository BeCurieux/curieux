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
