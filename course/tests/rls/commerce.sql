-- Purchases and refunds (migration 6): what the webhook, the success page
-- and the refund button all call. Runs after schema.sql.

\set ON_ERROR_STOP on
set client_min_messages = warning;

\ir helpers.sql

insert into auth.users (id, email) values
  ('12000000-0000-0000-0000-000000000001', 'rae@example.test'),
  ('12000000-0000-0000-0000-000000000002', 'sol@example.test');

-- Rae buys Module 0 with the benchmark-pack bump.
do $$ begin
  if public.record_purchase('cs_rae_1', 'pi_rae_1', '12000000-0000-0000-0000-000000000001', 'module-0', 7800, 'AUD', true) <> 'recorded' then
    raise exception 'purchase not recorded';
  end if;
  -- The same session again (a retried webhook, or the success page after it): nothing new.
  if public.record_purchase('cs_rae_1', 'pi_rae_1', '12000000-0000-0000-0000-000000000001', 'module-0', 7800, 'AUD', true) <> 'duplicate' then
    raise exception 'duplicate not detected';
  end if;
  if (select count(*) from public.orders where stripe_session_id = 'cs_rae_1') <> 1 then raise exception 'duplicate order'; end if;
  if (select currency from public.orders where stripe_session_id = 'cs_rae_1') <> 'aud' then raise exception 'currency not lowercased'; end if;
  if public.tier_of('12000000-0000-0000-0000-000000000001') <> 'module0' then raise exception 'module0 not granted'; end if;
  if not public.has_benchmark_pack_of('12000000-0000-0000-0000-000000000001') then raise exception 'bump not granted'; end if;
  if (select bump_product_id from public.orders where stripe_session_id = 'cs_rae_1') is null then raise exception 'bump not on order'; end if;
end $$;

-- She refunds: access goes at once, the pack with it; refunding again does nothing.
do $$ begin
  if public.record_refund('pi_rae_1') <> 'refunded' then raise exception 'refund not recorded'; end if;
  if public.record_refund('pi_rae_1') <> 'already' then raise exception 'double refund'; end if;
  if public.record_refund('pi_nobody') <> 'unknown' then raise exception 'unknown refund'; end if;
  if public.tier_of('12000000-0000-0000-0000-000000000001') <> 'free' then raise exception 'refund did not revoke'; end if;
  if public.has_benchmark_pack_of('12000000-0000-0000-0000-000000000001') then raise exception 'refund kept the pack'; end if;
  if (select status from public.orders where stripe_session_id = 'cs_rae_1') <> 'refunded' then raise exception 'order not refunded'; end if;
end $$;

-- Founding: the counter moves in the webhook, stops at 30, and comes back on refund.
update public.products set places_sold = 29 where tier = 'founding';
do $$ begin
  if public.record_purchase('cs_sol_1', 'pi_sol_1', '12000000-0000-0000-0000-000000000002', 'founding', 34900, 'aud', false) <> 'recorded' then
    raise exception 'founding purchase not recorded';
  end if;
  if (select places_sold from public.products where tier = 'founding') <> 30 then raise exception 'counter did not move'; end if;
  -- The 31st, paid while the 30th was going through: refused, nothing recorded.
  if public.record_purchase('cs_late', 'pi_late', '12000000-0000-0000-0000-000000000001', 'founding', 34900, 'aud', false) <> 'sold_out' then
    raise exception '31st place sold';
  end if;
  if exists (select 1 from public.orders where stripe_session_id = 'cs_late') then raise exception 'sold-out order recorded'; end if;
  if (select places_sold from public.products where tier = 'founding') <> 30 then raise exception 'counter passed 30'; end if;
  if public.record_refund('pi_sol_1') <> 'refunded' then raise exception 'founding refund'; end if;
  if (select places_sold from public.products where tier = 'founding') <> 29 then raise exception 'refund did not free a place'; end if;
end $$;

-- Only the server can call them.
do $$ begin
  if has_function_privilege('authenticated', 'public.record_purchase(text, text, uuid, text, integer, text, boolean)', 'execute')
     or has_function_privilege('anon', 'public.record_purchase(text, text, uuid, text, integer, text, boolean)', 'execute') then
    raise exception 'record_purchase is callable over the API';
  end if;
  if has_function_privilege('authenticated', 'public.record_refund(text)', 'execute') then
    raise exception 'record_refund is callable over the API';
  end if;
end $$;

begin;
select pg_temp.act_as('12000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.record_purchase('cs_x', 'pi_x', '12000000-0000-0000-0000-000000000001', 'course', 0, 'aud', false)$q$, 'customer records her own purchase');
commit;

update public.products set places_sold = 0 where tier = 'founding';
