-- The trigger functions are only ever meant to run as triggers. Postgres
-- grants EXECUTE on new functions to PUBLIC, which also exposes them as
-- /rest/v1/rpc endpoints; calling one there fails (trigger functions can't
-- be called directly), but nothing should be able to try. Triggers keep
-- firing: EXECUTE is checked when a trigger is created, not when it fires.

revoke execute on function public.limit_profiles() from public, anon, authenticated;
revoke execute on function public.bump_profile_version() from public, anon, authenticated;
revoke execute on function public.snapshot_profile() from public, anon, authenticated;
revoke execute on function public.check_product_images() from public, anon, authenticated;
revoke execute on function public.assign_generation_version() from public, anon, authenticated;
