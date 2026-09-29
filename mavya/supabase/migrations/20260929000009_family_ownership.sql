-- Families and children belong to one organisation (docs/M2_CLASSES.md,
-- decision 1).
--
-- Existing families have no link to an organisation to infer one from, so
-- this refuses to run while any exist rather than guess. Assign them first.

alter table public.families add column organisation_id uuid references public.organisations (id) on delete cascade;

do $$
begin
  if exists (select 1 from public.families where organisation_id is null) then
    raise exception 'Families without an organisation exist. Assign organisation_id to each before applying this migration.';
  end if;
end $$;

alter table public.families
  alter column organisation_id set not null,
  add column primary_contact_name text,
  add column primary_contact_email text,
  add column primary_contact_phone text,
  add constraint families_organisation_id_id_key unique (organisation_id, id);

create index families_organisation_id_idx on public.families (organisation_id);

-- A child always belongs to its family's organisation. The composite key
-- makes the database refuse any other combination.
alter table public.children add column organisation_id uuid;

alter table public.children
  alter column organisation_id set not null,
  drop constraint children_family_id_fkey,
  add constraint children_family_fkey foreign key (organisation_id, family_id)
    references public.families (organisation_id, id) on delete cascade,
  add constraint children_organisation_id_id_key unique (organisation_id, id);

-- Classes reference their instructor by membership, within the same
-- organisation.
alter table public.staff_memberships
  add constraint staff_memberships_organisation_id_id_key unique (organisation_id, id);
