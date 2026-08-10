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
