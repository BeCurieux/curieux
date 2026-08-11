-- What we measure about how the product is used.
--
-- The whole table, so that this is checkable rather than asserted:
--
--     name        which of fifteen things happened
--     who         a keyed hash of a user id and a sixty-day window
--     count       one bounded number, or null
--     created_at  when
--
-- There is no user id, no family id, no memory id, no email, no name, no
-- text, no file name, no IP address, no user agent and no referrer. Not
-- redacted — absent. There is nowhere to put them, which is the only version
-- of this promise that survives somebody being in a hurry.
--
-- `who` rotates every sixty days, so the same person is a different token
-- next window and no history can be assembled across them. It is an HMAC:
-- not invertible without the salt, and with the salt only good for
-- confirming a guess about a user already named.
--
-- Why a table rather than a hosted analytics product: promise 1 on /promise
-- says we never sell a family's information or show them an advertisement.
-- Sending a parent's behaviour to an advertising company is that promise
-- broken with extra steps, and it would be broken by an npm install rather
-- than by a decision.

create table if not exists analytics_events (
  id         bigserial primary key,
  -- Not an enum. The list lives in lib/analytics/events.ts and a check
  -- constraint here would mean a migration every time a step is added, which
  -- is how a schema and a codebase start disagreeing.
  name       text not null,
  -- 32 hex characters of HMAC. Never a user id.
  who        text not null,
  count      integer,
  created_at timestamptz not null default now(),
  constraint analytics_count_bounded check (count is null or (count >= 0 and count <= 10000)),
  constraint analytics_who_is_a_hash check (who ~ '^[0-9a-f]{32}$')
);

create index if not exists analytics_events_at_idx on analytics_events(created_at desc);
create index if not exists analytics_events_name_idx on analytics_events(name, created_at desc);

-- Row-level security on, and no policy at all.
--
-- The same shape as the jobs table: protection enabled, zero policies, so
-- nothing holding the publishable key can read a row — which is every
-- browser that has ever loaded the site. Only the service credential reaches
-- it, which is the runner that writes and the funnel page that reads.
--
-- Families are not given a policy either. There is nothing here about any
-- particular family to show them, and a policy that returned rows matching
-- their pseudonym would be a way to confirm which pseudonym is theirs.
alter table analytics_events enable row level security;

/**
 * Throw away anything older than the retention window.
 *
 * Half a year, matching KEEP_FOR_DAYS in lib/analytics/events.ts. Called by
 * the daily sweep. A product that tells families it collects less than it
 * could has no business keeping behavioural data longer than it can use it,
 * and a retention promise nothing executes is a comment.
 */
create or replace function purge_old_analytics()
returns integer language plpgsql security definer set search_path = public as $$
declare gone integer;
begin
  delete from analytics_events where created_at < now() - interval '180 days';
  get diagnostics gone = row_count;
  return gone;
end $$;
