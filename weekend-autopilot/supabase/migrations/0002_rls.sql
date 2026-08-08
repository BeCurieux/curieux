-- Row Level Security (§50).
--
-- The invariant: a customer can read and write their own household's data and
-- nothing else. Everything is scoped through household membership rather than
-- through the plan's user_id, because a household can have more than one user
-- and a partner joining must not silently lose access to their own weekends.
--
-- Operational tables (jobs, provider_usage, ai_runs, generation runs) have RLS
-- enabled with NO permissive policy for ordinary users: they are reachable
-- only by the service role, which bypasses RLS. That is deliberate — it means
-- forgetting a policy fails closed.

-- ------------------------------------------------- membership helpers

create or replace function is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_users hu
    where hu.household_id = hid and hu.user_id = auth.uid()
  )
$$;

create or replace function owns_plan(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p where p.id = pid and is_household_member(p.household_id)
  )
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin from profiles p where p.id = auth.uid()),
    false
  )
$$;

-- ------------------------------------------------- enable everywhere

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'households', 'household_users', 'household_members',
    'preference_profiles', 'user_dislikes', 'taste_signals', 'category_stats',
    'weekend_checkins', 'plans', 'plan_items', 'plan_feedback', 'plan_events',
    'subscriptions', 'payments', 'notification_preferences', 'notifications',
    'affiliate_clicks', 'waitlist_entries', 'place_refs', 'markets',
    'plan_generation_runs', 'plan_candidates', 'provider_usage', 'ai_runs',
    'feature_flags', 'admin_flags', 'audit_events', 'jobs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ------------------------------------------------- profiles

create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());

create policy profiles_self_update on profiles
  for update using (id = auth.uid())
  -- is_admin is not self-grantable: the WITH CHECK re-reads the stored value.
  with check (id = auth.uid() and is_admin = (select p.is_admin from profiles p where p.id = auth.uid()));

-- ------------------------------------------------- households

create policy households_member_read on households
  for select using (is_household_member(id) or is_admin());

create policy households_owner_insert on households
  for insert with check (owner_user_id = auth.uid());

create policy households_member_update on households
  for update using (is_household_member(id)) with check (is_household_member(id));

create policy household_users_self_read on household_users
  for select using (user_id = auth.uid() or is_household_member(household_id) or is_admin());

create policy household_users_owner_insert on household_users
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from households h where h.id = household_id and h.owner_user_id = auth.uid())
  );

create policy household_users_owner_delete on household_users
  for delete using (
    exists (select 1 from households h where h.id = household_id and h.owner_user_id = auth.uid())
  );

-- ------------------------------------------------- household-scoped tables

-- Every table below follows the same rule; generated rather than written out
-- twenty times, so a new household-scoped table cannot accidentally get a
-- different policy.
do $$
declare t text;
begin
  foreach t in array array[
    'household_members', 'preference_profiles', 'user_dislikes', 'taste_signals',
    'category_stats', 'weekend_checkins', 'plan_feedback', 'plan_events',
    'notification_preferences', 'notifications', 'affiliate_clicks'
  ] loop
    execute format(
      'create policy %1$s_member_all on %1$I for all
         using (is_household_member(household_id) or is_admin())
         with check (is_household_member(household_id))', t
    );
  end loop;
end $$;

-- ------------------------------------------------- plans

-- Customers read their plans; they never write them. Plans are created by the
-- generation job under the service role, and the only customer-initiated
-- change (marking one opened, requesting a swap) goes through a server action
-- that validates the transition.
create policy plans_member_read on plans
  for select using (is_household_member(household_id) or is_admin());

create policy plan_items_member_read on plan_items
  for select using (owns_plan(plan_id) or is_admin());

-- ------------------------------------------------- billing

create policy subscriptions_member_read on subscriptions
  for select using (is_household_member(household_id) or is_admin());

-- Payments are written by the Stripe webhook under the service role and are
-- never customer-writable.
create policy payments_member_read on payments
  for select using (
    (household_id is not null and is_household_member(household_id)) or is_admin()
  );

-- ------------------------------------------------- reference data

-- Markets and place refs are shared reference data: readable by any signed-in
-- user, writable only by the service role.
create policy markets_read on markets for select using (true);
create policy place_refs_read on place_refs for select using (auth.uid() is not null);

-- Anyone may join the waitlist; nobody but an admin may read it. Without the
-- read restriction the table is an email list available to any visitor.
create policy waitlist_insert on waitlist_entries for insert with check (true);
create policy waitlist_admin_read on waitlist_entries for select using (is_admin());

-- ------------------------------------------------- admin-only surfaces

create policy generation_runs_admin_read on plan_generation_runs
  for select using (is_household_member(household_id) or is_admin());

create policy plan_candidates_admin_read on plan_candidates
  for select using (is_admin());

create policy provider_usage_admin_read on provider_usage for select using (is_admin());
create policy ai_runs_admin_read on ai_runs for select using (is_admin());
create policy admin_flags_admin_all on admin_flags for all using (is_admin()) with check (is_admin());
create policy audit_events_admin_read on audit_events for select using (is_admin());
create policy feature_flags_read on feature_flags for select using (auth.uid() is not null);

-- `jobs` intentionally has RLS enabled and no policy: service role only.
