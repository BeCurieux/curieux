-- Choosing a cover colour.
--
-- The age spectrum stays the default — it is what makes a shelf of eighteen
-- read as one set. But two things parents want are not expressible in it:
-- changing a single volume, and making every volume the same.
--
-- Two nullable columns rather than one, because those are different wishes
-- and collapsing them loses information. A parent who sets "all walnut" and
-- then makes one book brick must not have that book quietly reset the next
-- time they change the standing preference.

-- The child's standing preference. Null means the age spectrum.
alter table subjects add column cover_colour text;

-- This volume only. Null means "follow the rule above".
alter table books add column cover_colour text;

comment on column subjects.cover_colour is
  'Colour id from AGE_COLOURS, or null for the age spectrum. Not a foreign '
  'key: the palette lives in code, and a colour retired from it must not '
  'break a book printed in it four years ago.';

comment on column books.cover_colour is
  'Colour id from AGE_COLOURS overriding both the subject preference and the '
  'age spectrum, or null to follow them.';

-- ------------------------------------------------------------------ RLS
--
-- No new policies. Both tables are already scoped through family membership,
-- and the write path goes through a server action that checks canEdit — a
-- contributor may add to the archive but not restyle the object that gets
-- printed and posted.
--
-- Not revoked from `authenticated` the way the scan verdict is: this is a
-- preference the family owns, not a verdict about them, and RLS on the row
-- already limits it to their own books.
