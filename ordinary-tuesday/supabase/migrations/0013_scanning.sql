-- Uploads are checked before they are served.
--
-- Until now the browser told the server what it had uploaded and the server
-- wrote it down: MIME type, checksum, dimensions. All three are
-- attacker-controlled, and the MIME type is the one Supabase hands back in a
-- Content-Type header when the file is fetched through a signed URL — so a
-- file uploaded as text/html was a script running on the storage origin.
--
-- A scan job now reads the bytes server-side, corrects the record from them,
-- and records a verdict. Nothing serves an asset that has not reached 'clean'.

-- Separate from processing_status, which answers a different question:
-- processing_status is "has the analysis run", this is "is it safe to serve".
-- A file can be analysed and dangerous, or clean and not yet looked at.
create type scan_verdict as enum ('pending', 'clean', 'quarantined', 'failed');

alter table media_assets
  add column scan_verdict scan_verdict not null default 'pending',
  -- Plain English and shown to the parent, so it says what to do next.
  add column scan_reason  text,
  add column scanned_at   timestamptz,
  -- Kept alongside the corrected mime_type rather than replacing it. A
  -- systematic gap between what browsers claim and what files are is worth
  -- being able to see, and it is the only evidence left after the fact.
  add column declared_mime text,
  -- Which scanner produced the verdict. A row scanned by the mock must not
  -- be indistinguishable later from one a real engine passed.
  add column scanned_by  text,
  -- The engine's signature name, when there was one. Recorded because it is
  -- what makes a refusal auditable; never shown to a parent, because
  -- "Win.Trojan.Agent-1234567" is not an explanation.
  add column scan_signature text;

-- The serving gate is a filter on this column, so it wants an index.
create index media_assets_scan_verdict_idx on media_assets (scan_verdict);

-- Existing rows stay 'pending' deliberately: they were never verified, and
-- back-filling them to 'clean' would be asserting something nobody checked.
-- Re-running the scan job over them is the way to clear them.

-- ------------------------------------------------------------------ RLS
--
-- No new policies. media_assets is already reachable only through family
-- membership, and the verdict is family-visible: a contributor whose upload
-- was refused should be able to see that it was, and why.

-- Only the service role writes a verdict. A client that could set its own
-- would make the whole gate decorative.
revoke update (scan_verdict, scan_reason, scanned_at, scanned_by, scan_signature)
  on media_assets from authenticated, anon;

-- ------------------------------------------------- telling the family
--
-- A refused file is exactly the kind of thing the activity log exists for:
-- something happened to a parent's archive that they did not do. It is also
-- the one entry where the "record people, not content" rule needs care —
-- the reason describes the file's type, never anything about its contents.
alter type activity_kind add value if not exists 'upload_refused';
