// Taking something in.
//
// Both doors — the share sheet and the address — end up here, and that is
// the point of the file. Two capture paths that each did their own storage
// upload, their own duplicate check and their own scan enqueue would be two
// paths that drift, and the one that drifts is the one that quietly stops
// scanning attachments.
//
// Everything an arrival gets, an ordinary upload also gets: the bytes go to
// the private bucket, the claimed type is written down as a claim, and a
// scan job decides whether the file may ever be served. Nothing here is a
// shortcut around a rule; it is a different way in to the same rules.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { enqueue } from "@/lib/jobs/queue";
import { fileArrival, type ArrivedVia } from "./triage";

export interface IncomingFile {
  bytes: Buffer;
  /** What the sender's device claimed. Corrected later by the scan job. */
  mimeType: string;
  filename: string;
}

export interface Incoming {
  subjectId: string;
  /** Whose archive entry this becomes. For mail, the family member's user. */
  createdBy: string;
  via: ArrivedVia;
  /** A share sheet title or a mail subject. Never used as the memory's text. */
  note?: string | null;
  /** Typed words, if there were any. */
  text?: string | null;
  files?: IncomingFile[];
  /** 'pending' sends it to the review queue instead of straight in. */
  status?: "approved" | "pending";
  /**
   * True when we had to guess which child this belongs to.
   *
   * A share sheet cannot ask, so a family with two children gets a guess —
   * and a guess we do not say out loud is a misfiling nobody ever finds.
   * Holds the arrival in the inbox so the guess is visible and one tap from
   * being corrected.
   */
  guessedSubject?: boolean;
  arrivedAt?: string;
}

export interface Received {
  memoryIds: string[];
  /** How many landed with something still to ask. Usually zero. */
  unfiled: number;
}

/** What we call an arrival, from what actually arrived. */
function typeOf(file: IncomingFile | null, text: string | null): string {
  if (!file) return text && text.length <= 200 ? "quote" : "text";
  if (file.mimeType.startsWith("video/")) return "video";
  if (file.mimeType.startsWith("audio/")) return "voice";
  return "photo";
}

const extensionOf = (filename: string, mime: string) => {
  const fromName = filename.includes(".") ? filename.split(".").pop()! : "";
  if (/^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  return (mime.split("/")[1] ?? "bin").replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
};

/**
 * Keep whatever arrived.
 *
 * Files and words in one call because one share is one act: a photograph
 * captioned "her face" is not two memories, and splitting it would put the
 * caption in the book without the picture it describes.
 */
export async function receive(db: SupabaseClient, incoming: Incoming): Promise<Received> {
  const arrivedAt = incoming.arrivedAt ?? new Date().toISOString();
  const files = incoming.files ?? [];
  const text = incoming.text?.trim() || null;
  const memoryIds: string[] = [];
  let unfiled = 0;

  // A share with words and no file is one memory; a share with three photos
  // is three, and the words ride with the first so they are not orphaned.
  const parts: (IncomingFile | null)[] = files.length > 0 ? files : [null];

  for (const [index, file] of parts.entries()) {
    const carriesText = index === 0 ? text : null;
    const type = typeOf(file, carriesText);

    // Capture time is not read here on purpose. EXIF lives in the bytes, and
    // the bytes are the scan job's business — it already opens every file,
    // and having two places parse untrusted image headers is one place too
    // many. Until it reports back, an undated photograph is undated, which
    // is exactly what the inbox is for.
    const filed = fileArrival({ type, arrivedAt, via: incoming.via });
    const settled = filed.question === null && !incoming.guessedSubject;

    const { data: memory, error } = await db
      .from("memories")
      .insert({
        subject_id: incoming.subjectId,
        created_by: incoming.createdBy,
        type,
        raw_text: carriesText,
        memory_date: filed.memoryDate,
        metadata: {},
        contribution_status: incoming.status ?? "approved",
        visibility: "family",
        arrived_via: incoming.via,
        arrival_note: incoming.note?.slice(0, 500) ?? null,
        // Filed on arrival unless something is genuinely unanswerable. The
        // inbox is the residue, not the pile.
        filed_at: settled ? arrivedAt : null,
      })
      .select("id")
      .single();

    if (error || !memory) throw new Error(error?.message ?? "could not keep that");
    memoryIds.push(memory.id);
    if (!settled) unfiled++;

    if (!file) continue;

    const checksum = createHash("sha256").update(file.bytes).digest("hex");
    const path = `${incoming.createdBy}/${incoming.subjectId}/${checksum}.${extensionOf(file.filename, file.mimeType)}`;

    const { error: upErr } = await db.storage
      .from("media")
      .upload(path, file.bytes, { contentType: file.mimeType, upsert: true });
    if (upErr) throw new Error(`could not store that file: ${upErr.message}`);

    const { data: asset, error: assetErr } = await db
      .from("media_assets")
      .insert({
        memory_id: memory.id,
        storage_path: path,
        // A claim, like every other upload's. scan_verdict stays 'pending',
        // which is what stops the file being served, laid out or printed
        // until something has actually read it.
        mime_type: file.mimeType,
        checksum,
        processing_status: "pending",
      })
      .select("id")
      .single();
    if (assetErr || !asset) throw new Error(assetErr?.message ?? "could not record that file");

    await enqueue(db, "scan_asset", { asset_id: asset.id }, `scan-${asset.id}`);
  }

  const window = Math.floor(Date.parse(arrivedAt) / (60 * 60 * 1000));
  await enqueue(
    db,
    "analyse_memories",
    { subject_id: incoming.subjectId },
    `analyse-${incoming.subjectId}-${window}`
  );

  return { memoryIds, unfiled };
}
