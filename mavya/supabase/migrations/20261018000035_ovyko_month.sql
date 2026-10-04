-- This month with Ovyko (docs/M8_NETWORK.md, M8a): what Ovyko did for a
-- school in a month, counted from the records, for its owners. Read only.

create function public.ovyko_month(p_org uuid, p_month date)
returns table (
  makeups_delivered integer,
  makeups_value_cents bigint,
  offers_claimed integer,
  offers_automatic integer,
  absences_by_parents integer,
  makeups_booked_by_parents integer,
  paid_online_count integer,
  paid_online_cents bigint,
  instalments_taken integer,
  instalments_cents bigint,
  reminders_sent integer,
  chased_paid_families integer,
  chased_paid_cents bigint,
  reenrol_answers integer,
  staying integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  m_start timestamptz;
  m_end timestamptz;
begin
  if p_org is null or p_month is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select timezone into tz from public.organisations where id = p_org;
  m_start := date_trunc('month', p_month)::timestamp at time zone tz;
  m_end := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone tz;

  return query
  with staff as (
    select user_id from public.staff_memberships where organisation_id = p_org
  ),
  delivered as (
    select coalesce(c.price_per_lesson_cents, 0)::bigint as cents
      from public.makeup_bookings b
      join public.class_occurrences o on o.id = b.target_occurrence_id
      join public.classes c on c.id = o.class_id
     where b.organisation_id = p_org and b.status in ('booked', 'completed')
       and o.status <> 'cancelled'
       and o.starts_at >= m_start and o.starts_at < least(m_end, now())
  ),
  paid as (
    select p.id, p.amount_cents,
           exists (select 1 from public.instalments i
                    where i.online_payment_id = p.id and i.seq > 1) as instalment
      from public.online_payments p
     where p.organisation_id = p_org and p.status = 'paid'
       and p.paid_at >= m_start and p.paid_at < m_end
  ),
  chased as (
    select l.family_id, -l.amount_cents as cents
      from public.ledger_entries l
     where l.organisation_id = p_org and l.kind = 'payment'
       and l.created_at >= m_start and l.created_at < m_end
       and not exists (select 1 from public.ledger_entries c where c.cancels_id = l.id)
       and exists (select 1 from public.email_deliveries e
                    where e.organisation_id = p_org and e.kind = 'fee_reminder'
                      and e.status = 'sent'
                      and e.payload ->> 'family_id' = l.family_id::text
                      and e.sent_at <= l.created_at
                      and e.sent_at > l.created_at - interval '14 days')
  )
  select
    (select count(*) from delivered)::integer,
    (select coalesce(sum(cents), 0) from delivered)::bigint,
    (select count(*) from public.vacancy_offers v
      where v.organisation_id = p_org and v.status = 'claimed'
        and v.responded_at >= m_start and v.responded_at < m_end)::integer,
    (select count(*) from public.vacancy_offers v
      where v.organisation_id = p_org and v.status = 'claimed' and v.offered_by is null
        and v.responded_at >= m_start and v.responded_at < m_end)::integer,
    (select count(*) from public.absences a
      where a.organisation_id = p_org and a.reported_at >= m_start and a.reported_at < m_end
        and a.created_by is not null and a.created_by not in (select user_id from staff))::integer,
    (select count(*) from public.makeup_bookings b
      where b.organisation_id = p_org and b.booked_at >= m_start and b.booked_at < m_end
        and b.created_by is not null and b.created_by not in (select user_id from staff))::integer,
    (select count(*) from paid)::integer,
    (select coalesce(sum(amount_cents), 0) from paid)::bigint,
    (select count(*) from paid where instalment)::integer,
    (select coalesce(sum(amount_cents), 0) from paid where instalment)::bigint,
    (select count(*) from public.email_deliveries e
      where e.organisation_id = p_org and e.kind = 'fee_reminder' and e.status = 'sent'
        and e.sent_at >= m_start and e.sent_at < m_end)::integer,
    (select count(distinct family_id) from chased)::integer,
    (select coalesce(sum(cents), 0) from chased)::bigint,
    (select count(*) from public.reenrolment_asks r
      where r.organisation_id = p_org and r.answered_by is not null
        and r.answered_at >= m_start and r.answered_at < m_end)::integer,
    (select count(*) from public.reenrolment_asks r
      where r.organisation_id = p_org and r.answered_by is not null and r.answer = 'stay'
        and r.answered_at >= m_start and r.answered_at < m_end)::integer;
end;
$$;

revoke all on function public.ovyko_month(uuid, date) from public, anon;
grant execute on function public.ovyko_month(uuid, date) to authenticated;
