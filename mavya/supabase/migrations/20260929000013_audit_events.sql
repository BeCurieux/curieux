-- Who changed what (CLAUDE.md rule 7).
--
-- Written only by the trigger below, never by the app, so a change can't
-- skip its audit row. The actor is the signed-in user, or null for the
-- seed and other service-role work.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  organisation_id uuid references public.organisations (id) on delete cascade,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_organisation_created_idx on public.audit_events (organisation_id, created_at desc);

alter table public.audit_events enable row level security;

create function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  after_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  changed jsonb := coalesce(after_row, before_row);
begin
  if tg_op = 'UPDATE' and before_row = after_row then
    return null;
  end if;
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), (changed ->> 'organisation_id')::uuid, lower(tg_op), tg_table_name,
     (changed ->> 'id')::uuid, before_row, after_row);
  return null;
end;
$$;

revoke all on function private.audit_change() from public;

create trigger audit_locations after insert or update or delete on public.locations
  for each row execute function private.audit_change();
create trigger audit_programs after insert or update or delete on public.programs
  for each row execute function private.audit_change();
create trigger audit_levels after insert or update or delete on public.levels
  for each row execute function private.audit_change();
create trigger audit_classes after insert or update or delete on public.classes
  for each row execute function private.audit_change();
-- Generated lessons aren't audited one by one; changes to a lesson are.
create trigger audit_class_occurrences after update on public.class_occurrences
  for each row execute function private.audit_change();
create trigger audit_families after insert or update or delete on public.families
  for each row execute function private.audit_change();
create trigger audit_children after insert or update or delete on public.children
  for each row execute function private.audit_change();
create trigger audit_enrolments after insert or update or delete on public.enrolments
  for each row execute function private.audit_change();
