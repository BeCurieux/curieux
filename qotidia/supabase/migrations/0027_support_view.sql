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
