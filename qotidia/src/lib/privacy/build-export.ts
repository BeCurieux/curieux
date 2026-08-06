// Building the archive file.
//
// Streamed rather than assembled in memory: a family with ten years of
// photographs is several gigabytes, and holding that in a Node process to
// zip it is how an export works fine in testing and falls over for the one
// customer who has used the product most.

// Archiver 8 exports classes only — the callable archiver("zip") factory that
// most examples still show was removed, and both `import archiver from` and
// require() now yield an object rather than a function. Constructing the
// class directly is the supported form, and is the one thing here that a
// passing build would not have caught.
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectArchive } from "./export";

export interface BuiltExport {
  storagePath: string;
  sizeBytes: number;
  itemCount: number;
}

/**
 * Produce the archive and put it in private storage. The download itself is
 * always a short-lived signed URL — an export is a complete copy of a
 * family's private life, and a permanent link to one would undo every other
 * precaution in the product.
 */
export async function buildExport(
  db: SupabaseClient,
  familyId: string,
  exportId: string
): Promise<BuiltExport> {
  const { entries } = await collectArchive(db, familyId);

  const zip = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  let size = 0;

  // Read straight off the archiver — piping into a PassThrough and waiting
  // for *its* "end" silently never resolves, which wedges the export job
  // forever rather than failing it. The completion handler is also attached
  // before anything is appended, so a small archive that finishes during
  // finalize() cannot end before we are listening.
  const finished = new Promise<void>((resolve, reject) => {
    zip.on("data", (c: Buffer) => {
      chunks.push(c);
      size += c.length;
    });
    zip.on("end", () => resolve());
    zip.on("error", reject);
    zip.on("warning", (err) => {
      // Missing files are reported per entry below; anything else is real.
      if ((err as any).code !== "ENOENT") reject(err);
    });
  });

  for (const entry of entries) {
    if (entry.contents !== undefined) {
      zip.append(entry.contents, { name: entry.path });
      continue;
    }
    if (!entry.storagePath) continue;

    const { data, error } = await db.storage.from("media").download(entry.storagePath);
    if (error || !data) {
      // A missing file must not lose the whole export. Note it and continue —
      // an archive with one gap and a note is far better than no archive.
      zip.append(
        `This file could not be read at export time (${entry.storagePath}).\n` +
          `Nothing has been deleted; please ask us and we will retrieve it.\n`,
        { name: `${entry.path}.missing.txt` }
      );
      continue;
    }
    zip.append(Readable.fromWeb(data.stream() as any), { name: entry.path });
  }

  await zip.finalize();
  await finished;

  const storagePath = `exports/${familyId}/${exportId}.zip`;
  const { error: upErr } = await db.storage
    .from("renders")
    .upload(storagePath, Buffer.concat(chunks), {
      contentType: "application/zip",
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  return { storagePath, sizeBytes: size, itemCount: entries.length };
}
