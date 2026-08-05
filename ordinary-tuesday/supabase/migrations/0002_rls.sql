-- Ordinary Tuesday — Row Level Security.
-- Rule (brief §4): a user must never access another user's children,
-- memories or generated books. Everything is scoped through family ownership.

-- ------------------------------------------------- ownership helpers

create or replace function owns_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from families f where f.id = fid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_child(cid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from children c join families f on f.id = c.family_id
     where c.id = cid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     join children c on c.id = m.child_id
     join families f on f.id = c.family_id
     where m.id = mid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_cluster(clid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memory_clusters mc where mc.id = clid and owns_child(mc.child_id)) $$;

create or replace function owns_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from books b where b.id = bid and owns_child(b.child_id)) $$;

create or replace function owns_page(pid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from book_pages p where p.id = pid and owns_book(p.book_id)) $$;

-- ------------------------------------------------- enable RLS everywhere

alter table profiles            enable row level security;
alter table families            enable row level security;
alter table family_members      enable row level security;
alter table children            enable row level security;
alter table memories            enable row level security;
alter table media_assets        enable row level security;
alter table memory_people       enable row level security;
alter table memory_tags         enable row level security;
alter table memory_clusters     enable row level security;
alter table cluster_memories    enable row level security;
alter table follow_up_questions enable row level security;
alter table little_things       enable row level security;
alter table books               enable row level security;
alter table book_sections       enable row level security;
alter table book_pages          enable row level security;
alter table book_content_blocks enable row level security;
alter table book_approvals      enable row level security;
alter table print_orders        enable row level security;
alter table jobs                enable row level security; -- no policies: service role only

-- ------------------------------------------------- policies

create policy "own profile read"  on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());

create policy "families all" on families for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "family_members all" on family_members for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "children all" on children for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "memories all" on memories for all
  using (owns_child(child_id))
  with check (owns_child(child_id) and created_by = auth.uid());

create policy "media_assets all" on media_assets for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_people all" on memory_people for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_tags all" on memory_tags for all
  using (owns_memory(memory_id)) with check (owns_memory(memory_id));

create policy "memory_clusters all" on memory_clusters for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "cluster_memories all" on cluster_memories for all
  using (owns_cluster(cluster_id)) with check (owns_cluster(cluster_id) and owns_memory(memory_id));

create policy "follow_up_questions all" on follow_up_questions for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "little_things all" on little_things for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "books all" on books for all
  using (owns_child(child_id)) with check (owns_child(child_id));

create policy "book_sections all" on book_sections for all
  using (owns_book(book_id)) with check (owns_book(book_id));

create policy "book_pages all" on book_pages for all
  using (owns_book(book_id)) with check (owns_book(book_id));

create policy "book_content_blocks all" on book_content_blocks for all
  using (owns_page(page_id)) with check (owns_page(page_id));

-- Approvals are written by the server after explicit confirmation; users may read their own.
create policy "book_approvals read" on book_approvals for select using (owns_book(book_id));

-- Print orders are created/updated by the server (service role); users may read their own.
create policy "print_orders read" on print_orders for select using (owns_book(book_id));
