-- Is anything unprotected?
--
-- Row-level security is what stands between one family's archive and
-- another's. Every claim this product makes about privacy is enforced by it,
-- and a table that has it switched off is readable by anyone holding the
-- publishable key — which is every browser that has ever loaded the site.
--
-- Paste this into the Supabase SQL editor after setting a project up, and
-- after any change to the schema. It lists only what is wrong, so a short
-- answer is a good answer.
--
-- Expect exactly three rows:
--
--     ai_calls         | on | 0
--     analytics_events | on | 0
--     jobs             | on | 0
--
-- All three are correct and deliberate, and for the same reason. jobs is the
-- background queue, analytics_events is usage measurement and ai_calls is
-- what the model cost; all three are touched only by the service role, which
-- bypasses row-level security entirely, so all three have protection
-- switched on and no policies at all — the effect is that nothing reachable
-- from a browser can see any of them. Zero policies is listed here rather
-- than hidden because on any *other* table it would mean the opposite:
-- locked so tight the feature is quietly broken.
--
-- analytics_events has no policy for families either. There is nothing in it
-- about any particular family to show them, and a policy that returned rows
-- matching their own pseudonym would be a way to confirm which pseudonym is
-- theirs.
--
-- Anything reading "OFF" is serious. Do not put a real family's archive in a
-- project that reports one.

select c.relname as "table",
       case when c.relrowsecurity then 'on' else 'OFF — readable by anyone' end
         as "row-level security",
       count(p.policyname) as "policies"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
having not c.relrowsecurity or count(p.policyname) = 0
order by c.relrowsecurity, c.relname;
