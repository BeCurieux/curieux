-- The product was renamed from Franca to Tildie on 2026-09-28 (BRIEF.md §11
-- item 0). The storage functions follow, so the only place the old name
-- survives in the database is the migration that first created them.
--
-- ALTER FUNCTION ... RENAME keeps each function's body, owner and grants, so
-- the revoke-from-public / grant-to-service_role lock-down carries over as is.

alter function public.franca_get_installation(text) rename to tildie_get_installation;
alter function public.franca_put_installation(jsonb) rename to tildie_put_installation;
alter function public.franca_get_catalogue(text) rename to tildie_get_catalogue;
alter function public.franca_replace_catalogue(text, timestamptz, text[], jsonb, boolean, jsonb) rename to tildie_replace_catalogue;
alter function public.franca_put_product_scan(text, text, timestamptz, jsonb) rename to tildie_put_product_scan;
alter function public.franca_mark_product_stale(text, text) rename to tildie_mark_product_stale;
alter function public.franca_remove_product_scan(text, text) rename to tildie_remove_product_scan;
alter function public.franca_claim_delivery(text, text, timestamptz, interval) rename to tildie_claim_delivery;
alter function public.franca_settle_delivery(text, text) rename to tildie_settle_delivery;
alter function public.franca_prune_deliveries(timestamptz) rename to tildie_prune_deliveries;
alter function public.franca_redact_shop(text) rename to tildie_redact_shop;
