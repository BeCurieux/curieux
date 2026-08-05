-- "Hear this moment" — voice memories reachable from the printed page.
--
-- A printed book is handed to grandparents who will never have an account.
-- So a QR code on the page cannot require a login — but it also must not
-- become a permanent public URL to a family's private recordings (§4).
--
-- The design: each book carries one secret token, minted when the book is
-- approved for print. That token reaches ONLY the recordings printed in that
-- book, and only through a security-definer function that hands back a
-- short-lived signed URL. The token can be revoked without touching the data.

-- ---------------------------------------------------------------- audio

-- Voice memories live in the same private bucket as photographs; nothing
-- about storage becomes public.
alter table media_assets add column if not exists transcript_status processing_status;

-- ---------------------------------------------------------------- token

alter table books add column listen_token uuid;
create unique index books_listen_token_idx on books (listen_token) where listen_token is not null;

-- Minted at approval, so a draft book's QR codes can never resolve.
create or replace function mint_listen_token(bid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select listen_token into t from books where id = bid;
  if t is null then
    t := gen_random_uuid();
    update books set listen_token = t where id = bid;
  end if;
  return t;
end $$;

-- Revoke without deleting anything: the printed codes simply stop resolving.
create or replace function revoke_listen_token(bid uuid)
returns void language sql security definer set search_path = public as
$$ update books set listen_token = null where id = bid and owns_book(bid) $$;

-- ---------------------------------------------------------------- resolve

-- Anonymous callers reach this and nothing else. It answers one question:
-- "does this token's book actually print this memory, and if so where is the
-- audio?" Anything not printed in that book is invisible.
create or replace function resolve_listen(token uuid, mid uuid)
returns table (
  storage_path text,
  mime_type    text,
  transcript   text,
  memory_date  date,
  subject_name text,
  book_title   text
)
language sql stable security definer set search_path = public as $$
  select
    a.storage_path,
    a.mime_type,
    m.transcript,
    m.memory_date,
    s.display_name,
    b.title
  from books b
  join book_pages p          on p.book_id = b.id
  join book_content_blocks c on c.page_id = p.id
  join memories m            on m.id::text = c.content
  join media_assets a        on a.memory_id = m.id
  join subjects s            on s.id = m.subject_id
  where b.listen_token = token
    and b.listen_token is not null
    and m.id = mid
    and m.type = 'voice'
    and a.mime_type like 'audio/%'
  limit 1;
$$;

-- The function is the only door; the tables stay closed.
revoke all on function resolve_listen(uuid, uuid) from public;
grant execute on function resolve_listen(uuid, uuid) to anon, authenticated;

revoke all on function mint_listen_token(uuid) from public;
revoke all on function revoke_listen_token(uuid) from public;
grant execute on function revoke_listen_token(uuid) to authenticated;

-- Which moments in a book can be listened to — used to lay out the QR codes.
create or replace function book_listenable(bid uuid)
returns table (memory_id uuid, page_number int, transcript text)
language sql stable security definer set search_path = public as $$
  select distinct m.id, p.page_number, m.transcript
  from book_pages p
  join book_content_blocks c on c.page_id = p.id
  join memories m            on m.id::text = c.content
  join media_assets a        on a.memory_id = m.id
  where p.book_id = bid
    and owns_book(bid)
    and m.type = 'voice'
    and a.mime_type like 'audio/%'
  order by p.page_number;
$$;

grant execute on function book_listenable(uuid) to authenticated;
