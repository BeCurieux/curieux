-- Government activity vouchers (docs/M7_PAYMENTS.md, M7d part 1). Each
-- school picks the schemes it's registered for; parents hand over a
-- voucher's code in Ovyko; the school redeems it in the government's portal
-- and Ovyko adds the credit, or the school declines it with a reason.

-- The schemes and what each is worth at most, in cents.
create function private.voucher_scheme_cents(p_scheme text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_scheme
    when 'nsw_active_creative_kids' then 5000
    when 'qld_fairplay' then 20000
    when 'sa_sports_vouchers' then 10000
    when 'wa_kidsport' then 30000
  end
$$;

revoke all on function private.voucher_scheme_cents(text) from public;

create function private.voucher_scheme_name(p_scheme text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_scheme
    when 'nsw_active_creative_kids' then 'Active and Creative Kids'
    when 'qld_fairplay' then 'FairPlay'
    when 'sa_sports_vouchers' then 'Sports Voucher'
    when 'wa_kidsport' then 'KidSport'
  end
$$;

revoke all on function private.voucher_scheme_name(text) from public;

alter table public.organisations
  add column voucher_schemes text[] not null default '{}'
    check (voucher_schemes <@ array['nsw_active_creative_kids', 'qld_fairplay',
                                    'sa_sports_vouchers', 'wa_kidsport']);

create function public.set_voucher_schemes(p_org uuid, p_schemes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was text[];
  now_on text[];
begin
  if p_org is null or p_schemes is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}') into now_on
    from unnest(p_schemes) s;
  if exists (select 1 from unnest(now_on) s where private.voucher_scheme_cents(s) is null) then
    raise exception 'Choose from the schemes listed.' using hint = 'voucher_invalid';
  end if;
  select voucher_schemes into was from public.organisations where id = p_org for update;
  if was = now_on then
    return;
  end if;
  update public.organisations set voucher_schemes = now_on where id = p_org;
  -- Organisations aren't audited row by row; this choice is.
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('voucher_schemes', was), jsonb_build_object('voucher_schemes', now_on));
end;
$$;

revoke all on function public.set_voucher_schemes(uuid, text[]) from public, anon;
grant execute on function public.set_voucher_schemes(uuid, text[]) to authenticated;

-- ------------------------------------------------------------------ vouchers handed over

create table public.voucher_claims (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  child_id uuid,
  scheme text not null check (private.voucher_scheme_cents(scheme) is not null),
  code text not null check (code ~ '^[A-Z0-9-]{4,40}$'),
  status text not null default 'submitted' check (status in ('submitted', 'redeemed', 'declined')),
  amount_cents integer check (amount_cents is null or amount_cents > 0),
  decline_reason text check (decline_reason is null or length(decline_reason) between 1 and 200),
  ledger_entry_id uuid unique,
  submitted_by uuid references public.users (id) on delete set null,
  decided_by uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organisation_id, scheme, code),
  check ((status = 'redeemed') = (amount_cents is not null)),
  check ((status = 'declined') = (decline_reason is not null)),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id)
    on delete set null (child_id),
  foreign key (ledger_entry_id) references public.ledger_entries (id) on delete set null
);

create index voucher_claims_org_idx on public.voucher_claims (organisation_id, status, created_at);
create index voucher_claims_family_idx on public.voucher_claims (family_id, created_at desc);

alter table public.voucher_claims enable row level security;
revoke all on public.voucher_claims from anon, authenticated;
grant select on public.voucher_claims to authenticated;

create policy voucher_claims_select on public.voucher_claims
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create trigger audit_voucher_claims after insert or update or delete on public.voucher_claims
  for each row execute function private.audit_change();

-- A parent hands over a voucher for one of their own children, for a scheme
-- the school takes. The code is kept as written, in capitals, without spaces.
create function public.submit_voucher(p_child uuid, p_scheme text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.children;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  new_id uuid;
begin
  select * into ch from public.children where id = p_child;
  if not found or ch.id not in (select private.my_child_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_scheme is null or not exists (
       select 1 from public.organisations
        where id = ch.organisation_id and p_scheme = any (voucher_schemes)) then
    raise exception 'Your activity provider doesn''t take that voucher in Ovyko.'
      using hint = 'voucher_invalid';
  end if;
  if v_code !~ '^[A-Z0-9-]{4,40}$' then
    raise exception 'Enter the voucher''s code as it appears on the voucher.'
      using hint = 'voucher_invalid';
  end if;
  if exists (select 1 from public.voucher_claims
              where organisation_id = ch.organisation_id and scheme = p_scheme and code = v_code) then
    raise exception 'That voucher has already been handed over.' using hint = 'voucher_used';
  end if;
  insert into public.voucher_claims
    (organisation_id, family_id, child_id, scheme, code, submitted_by)
  values (ch.organisation_id, ch.family_id, ch.id, p_scheme, v_code, private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_voucher(uuid, text, text) from public, anon;
grant execute on function public.submit_voucher(uuid, text, text) to authenticated;

-- The owner redeemed it in the government's portal: a credit for what the
-- portal gave, at most the scheme's value.
create function public.redeem_voucher(p_claim uuid, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.voucher_claims;
  line uuid;
begin
  select * into v from public.voucher_claims where id = p_claim for update;
  if not found or not private.is_org_member(v.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.status <> 'submitted' then
    raise exception 'That voucher has already been dealt with.' using hint = 'voucher_used';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0
     or p_amount_cents > private.voucher_scheme_cents(v.scheme) then
    raise exception 'Enter the amount the voucher gave, up to $%.',
      private.voucher_scheme_cents(v.scheme) / 100 using hint = 'voucher_invalid';
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, child_id, kind, amount_cents, description, created_by)
  values
    (v.organisation_id, v.family_id, v.child_id, 'credit', -p_amount_cents,
     private.voucher_scheme_name(v.scheme) || ' voucher', private.current_user_id())
  returning id into line;
  update public.voucher_claims
     set status = 'redeemed', amount_cents = p_amount_cents, ledger_entry_id = line,
         decided_by = private.current_user_id(), decided_at = now()
   where id = v.id;
  return line;
end;
$$;

revoke all on function public.redeem_voucher(uuid, integer) from public, anon;
grant execute on function public.redeem_voucher(uuid, integer) to authenticated;

create function public.decline_voucher(p_claim uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.voucher_claims;
begin
  select * into v from public.voucher_claims where id = p_claim for update;
  if not found or not private.is_org_member(v.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.status <> 'submitted' then
    raise exception 'That voucher has already been dealt with.' using hint = 'voucher_used';
  end if;
  if coalesce(trim(p_reason), '') = '' or length(trim(p_reason)) > 200 then
    raise exception 'Say why, so the family knows what to do.' using hint = 'voucher_invalid';
  end if;
  update public.voucher_claims
     set status = 'declined', decline_reason = trim(p_reason),
         decided_by = private.current_user_id(), decided_at = now()
   where id = v.id;
end;
$$;

revoke all on function public.decline_voucher(uuid, text) from public, anon;
grant execute on function public.decline_voucher(uuid, text) to authenticated;

-- What a parent's school takes, for the Fees screen.
create function public.my_voucher_schemes(p_org uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select o.voucher_schemes from public.organisations o
   where o.id = p_org
     and (p_org in (select private.my_family_org_ids())
          or private.is_org_member(p_org, array['owner']))
$$;

revoke all on function public.my_voucher_schemes(uuid) from public, anon;
grant execute on function public.my_voucher_schemes(uuid) to authenticated;
