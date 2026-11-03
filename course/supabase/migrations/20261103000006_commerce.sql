-- Recording purchases and refunds (SPEC.md → Webhook rules). One function
-- for each, called by the Stripe webhook, by the checkout success page (so
-- access doesn't wait on a slow webhook) and by the refund button, so the
-- state is the same whichever arrives first. Server only (service role).

-- A completed checkout: order, entitlement(s), founding counter. Idempotent
-- on the session id. Returns 'recorded', 'duplicate' or 'sold_out' (the
-- founding cohort filled while she was paying: nothing is recorded and the
-- caller refunds her).
create function public.record_purchase(
  p_session_id text,
  p_payment_intent text,
  p_user uuid,
  p_product_slug text,
  p_amount_cents integer,
  p_currency text,
  p_bump boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_bump_id uuid;
  v_order uuid;
begin
  if exists (select 1 from public.orders where stripe_session_id = p_session_id) then
    return 'duplicate';
  end if;

  select * into v_product from public.products where slug = p_product_slug;
  if not found or v_product.tier = 'free' then
    raise exception 'record_purchase: unknown product %', p_product_slug;
  end if;

  -- The founding counter, enforced here as well as at checkout: the row
  -- only moves while there's a place left.
  if v_product.places_total is not null then
    update public.products set places_sold = places_sold + 1
     where id = v_product.id and places_sold < places_total;
    if not found then
      return 'sold_out';
    end if;
  end if;

  if p_bump and v_product.tier <> 'benchmark_pack' then
    select id into v_bump_id from public.products where tier = 'benchmark_pack';
  end if;

  insert into public.orders (user_id, product_id, stripe_session_id, stripe_payment_intent,
                             amount_cents, currency, bump_product_id)
  values (p_user, v_product.id, p_session_id, p_payment_intent, p_amount_cents, lower(p_currency), v_bump_id)
  returning id into v_order;

  insert into public.entitlements (user_id, tier, granted_by_order_id)
  values (p_user, v_product.tier, v_order);
  if v_bump_id is not null then
    insert into public.entitlements (user_id, tier, granted_by_order_id)
    values (p_user, 'benchmark_pack', v_order);
  end if;

  return 'recorded';
end;
$$;

-- A full refund: order refunded, its entitlements revoked at once, a
-- founding place given back. Idempotent. Returns 'refunded', 'already' or
-- 'unknown' (no such order: e.g. a sold-out founding payment we refunded).
create function public.record_refund(p_payment_intent text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where stripe_payment_intent = p_payment_intent for update;
  if not found then
    return 'unknown';
  end if;
  if v_order.status = 'refunded' then
    return 'already';
  end if;

  update public.orders set status = 'refunded', refunded_at = now() where id = v_order.id;
  update public.entitlements set revoked_at = now()
   where granted_by_order_id = v_order.id and revoked_at is null;
  update public.products set places_sold = places_sold - 1
   where id = v_order.product_id and places_total is not null and places_sold > 0;

  return 'refunded';
end;
$$;

revoke all on function public.record_purchase(text, text, uuid, text, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.record_refund(text) from public, anon, authenticated;
grant execute on function public.record_purchase(text, text, uuid, text, integer, text, boolean) to service_role;
grant execute on function public.record_refund(text) to service_role;
