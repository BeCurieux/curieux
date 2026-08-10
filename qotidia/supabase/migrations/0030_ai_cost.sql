-- What the model cost, and for whom.
--
-- The whole table:
--
--     family_id      whose work it was, or null for something not a family's
--     kind           analyse | cluster | questions | structure | copy | edit
--     model          which model
--     input_tokens   how many went in
--     output_tokens  how many came out
--     cost           micro-cents, computed at the time from lib/ai/cost.ts
--     refused        set when a ceiling stopped the call before it happened
--     created_at     when
--
-- There is no prompt, no reply, no memory text, no quote, no transcript and
-- no child's name. A cost log that kept those would be a second copy of the
-- archive, held for accounting — and it would be the copy nobody thought to
-- put behind the privacy rules, because it is "just billing".
--
-- Unlike analytics_events, this one does record which family. That is not an
-- inconsistency: cost is an operational fact about an account in exactly the
-- way storage_bytes already is, and the number that decides whether A$19 a
-- month works is the cost of one family's year rather than the cost of last
-- Tuesday. Analytics asks "did the product work"; this asks "what did we
-- spend on this account". The first question does not need a family and the
-- second one is meaningless without it.
--
-- The row is written even when the work throws. A failed job that burned
-- forty thousand tokens still burned them, and a log that only records
-- successes under-reports exactly when something is going wrong.

create table if not exists ai_calls (
  id            bigserial primary key,
  family_id     uuid references families(id) on delete set null,
  kind          text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  -- Micro-cents. A hundred thousand is one dollar, so nothing here meets a
  -- floating-point rounding error.
  cost          bigint not null default 0,
  -- Null unless a ceiling stopped it. A refusal that leaves no trace is
  -- indistinguishable from nothing having been attempted, which is exactly
  -- what somebody wondering why a book never generated needs to know.
  refused       text,
  created_at    timestamptz not null default now(),
  constraint ai_calls_tokens_sane check (input_tokens >= 0 and output_tokens >= 0),
  constraint ai_calls_cost_sane check (cost >= 0)
);

-- on delete set null rather than cascade, deliberately. When a family
-- deletes their archive the cost of work already done does not become
-- untrue, and the row that remains says nothing about them: a kind, a model,
-- two token counts and a number. Erasure removes the link, not the
-- accounting.

create index if not exists ai_calls_at_idx on ai_calls(created_at desc);
create index if not exists ai_calls_family_idx on ai_calls(family_id, created_at desc);

-- Row-level security on, no policy at all. The same shape as jobs and
-- analytics_events: nothing holding the publishable key can read a row, and
-- only the service credential — the job runner that writes and the admin
-- page that reads — reaches it.
alter table ai_calls enable row level security;

/**
 * Throw away old cost rows.
 *
 * Kept longer than analytics because this is closer to a financial record:
 * a year, so a full cycle of the product can be looked at. Called by the
 * same daily sweep.
 */
create or replace function purge_old_ai_calls()
returns integer language plpgsql security definer set search_path = public as $$
declare gone integer;
begin
  delete from ai_calls where created_at < now() - interval '400 days';
  get diagnostics gone = row_count;
  return gone;
end $$;
