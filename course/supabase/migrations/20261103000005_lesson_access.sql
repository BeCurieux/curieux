-- One rule for "can she open this lesson", used by the lesson page, the
-- mark-complete policy and the download route, so they can't drift apart.
--
-- A lesson opens when her tier reaches its min_tier. Library lessons that
-- hold the benchmark sheets also open with the benchmark pack on its own
-- (SPEC.md → Access tiers: the pack is sold standalone as the Module 0 bump,
-- and the sheets live on the hidden Library module): those lessons set
-- opens_with_benchmark_pack in their frontmatter.

alter table public.lessons add column opens_with_benchmark_pack boolean not null default false;
grant select (opens_with_benchmark_pack) on public.lessons to anon, authenticated;

-- For the server (download route): any user, any lesson.
create function public.user_can_open_lesson(p_user uuid, p_lesson uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.tier_of(p_user) >= l.min_tier
           or (l.opens_with_benchmark_pack and public.has_benchmark_pack_of(p_user))
      from public.lessons l
     where l.id = p_lesson
  ), false);
$$;

revoke all on function public.user_can_open_lesson(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_can_open_lesson(uuid, uuid) to service_role;

-- For the signed-in caller.
create function public.can_open_lesson(p_lesson uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.user_can_open_lesson((select auth.uid()), p_lesson);
$$;

revoke all on function public.can_open_lesson(uuid) from public, anon;
grant execute on function public.can_open_lesson(uuid) to authenticated;

create or replace function public.lesson_content(p_lesson uuid)
returns table (video_provider text, video_id text, duration_sec integer, script_md text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.video_provider, l.video_id, l.duration_sec, l.script_md
    from public.lessons l
   where l.id = p_lesson
     and public.can_open_lesson(l.id);
$$;

drop policy "lesson_progress: mark own, on lessons she can open" on public.lesson_progress;
create policy "lesson_progress: mark own, on lessons she can open" on public.lesson_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_open_lesson(lesson_id));
