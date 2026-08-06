// Taking everything with you.
//
// A parent is more willing to put twelve years of their child's life into
// this if leaving is genuinely possible. So the export is the real thing:
// original files at original resolution, every note and quote as they were
// written, the structured record, and the finished books — in one archive
// that opens without us.
//
// Two decisions worth naming.
//
// The manifest is JSON *and* the folder layout is readable on its own. If
// this company disappears, a parent with a laptop and no software should
// still be able to open a folder called "2027" and find their photographs
// with sensible filenames. An export that needs our importer is not an exit.
//
// Nothing is downgraded. Not resized, not re-encoded, not stripped of
// timestamps. What went in is what comes out.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVABLE_VERDICT } from "@/lib/media/verify";

export interface ExportEntry {
  /** Path inside the archive, e.g. "2027/03-March/14-yellow-boots.jpg". */
  path: string;
  storagePath?: string;
  /** Inline content, for the notes and manifests we generate. */
  contents?: string;
}

export interface ExportManifest {
  exportedAt: string;
  family: { id: string };
  subjects: {
    id: string;
    name: string;
    dateOfBirth: string | null;
    memories: {
      id: string;
      date: string | null;
      type: string;
      text: string | null;
      transcript: string | null;
      file: string | null;
      /** Why the file is absent, when it is. null when nothing is missing. */
      fileMissing: string | null;
      addedBy: string;
      status: string;
    }[];
    littleThings: { category: string; value: string; recorded: string | null }[];
    books: { id: string; title: string; year: number | null; pdf: string | null }[];
  }[];
  note: string;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "untitled";

const MONTHS = [
  "01-January", "02-February", "03-March", "04-April", "05-May", "06-June",
  "07-July", "08-August", "09-September", "10-October", "11-November", "12-December",
];

/** Where a memory's file belongs in the folder tree a human will browse. */
export function pathForMemory(m: {
  memory_date: string | null;
  created_at: string;
  raw_text: string | null;
  type: string;
  id: string;
}, extension: string, subjectName: string): string {
  const when = new Date(m.memory_date ?? m.created_at);
  const year = Number.isNaN(when.getTime()) ? "undated" : String(when.getFullYear());
  const month = Number.isNaN(when.getTime()) ? "" : `/${MONTHS[when.getMonth()]}`;
  const day = Number.isNaN(when.getTime()) ? "" : String(when.getDate()).padStart(2, "0") + "-";
  const label = m.raw_text ? slug(m.raw_text) : `${m.type}-${m.id.slice(0, 6)}`;
  return `${slug(subjectName)}/${year}${month}/${day}${label}.${extension}`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/webm": "webm", "audio/wav": "wav",
  "image/svg+xml": "svg",
};

export const extensionFor = (mime: string | null): string =>
  (mime && EXTENSIONS[mime]) || "bin";

export const EXPORT_NOTE =
  `This is everything your family kept, exported from Qotidia.\n\n` +
  `The folders are arranged by child and by year, and the filenames describe ` +
  `what is in them, so you can browse this on any computer without our software ` +
  `and without us. manifest.json holds the same information in a structured ` +
  `form if you want to move it somewhere else.\n\n` +
  `Photographs and recordings are the originals — nothing has been resized, ` +
  `re-encoded or stripped. Your memories belong to your family.\n`;

/**
 * Assemble everything a family has. Returns the file list and the manifest;
 * writing the archive itself is the caller's job, so this stays testable.
 */
export async function collectArchive(
  db: SupabaseClient,
  familyId: string
): Promise<{ entries: ExportEntry[]; manifest: ExportManifest }> {
  const entries: ExportEntry[] = [];

  const { data: subjects } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth")
    .eq("family_id", familyId);

  const manifest: ExportManifest = {
    exportedAt: new Date().toISOString(),
    family: { id: familyId },
    subjects: [],
    note: EXPORT_NOTE,
  };

  for (const s of subjects ?? []) {
    const { data: memories } = await db
      .from("memories")
      .select("id, type, raw_text, transcript, memory_date, created_at, created_by, contribution_status, media_assets(storage_path, mime_type, scan_verdict, scan_reason)")
      .eq("subject_id", s.id)
      .order("memory_date");

    const memoryRows: ExportManifest["subjects"][number]["memories"] = [];

    for (const m of (memories ?? []) as any[]) {
      const asset = m.media_assets?.[0];
      let filePath: string | null = null;
      let missing: string | null = null;

      if (asset?.storage_path && asset.scan_verdict === SERVABLE_VERDICT) {
        filePath = pathForMemory(m, extensionFor(asset.mime_type), s.display_name);
        entries.push({ path: filePath, storagePath: asset.storage_path });
      } else if (asset) {
        // An export that quietly skipped a file would be the worst kind of
        // omission — the whole promise of this feature is that what comes
        // out is everything. So the manifest says the file is absent and
        // why, rather than the row simply having no file against it.
        missing = asset.scan_verdict === "pending"
          ? "This file had not finished being checked when the export was built."
          : asset.scan_reason ?? "This file was refused and is no longer stored.";
      }

      // Written text is also written out as a plain file beside the photo, so
      // the words survive without needing to parse anything.
      const text = m.raw_text ?? m.transcript;
      if (text && m.type !== "photo") {
        entries.push({
          path: pathForMemory(m, "txt", s.display_name),
          contents: text,
        });
      }

      memoryRows.push({
        id: m.id,
        date: m.memory_date,
        type: m.type,
        text: m.raw_text,
        transcript: m.transcript,
        file: filePath,
        fileMissing: missing,
        addedBy: m.created_by,
        status: m.contribution_status ?? "approved",
      });
    }

    const { data: littleThings } = await db
      .from("little_things")
      .select("category, value, recorded_date")
      .eq("subject_id", s.id);

    const { data: books } = await db
      .from("books")
      .select("id, title, year_number, digital_pdf_path")
      .eq("subject_id", s.id);

    for (const b of books ?? []) {
      if (b.digital_pdf_path) {
        entries.push({
          path: `${slug(s.display_name)}/books/${slug(b.title)}.pdf`,
          storagePath: b.digital_pdf_path,
        });
      }
    }

    manifest.subjects.push({
      id: s.id,
      name: s.display_name,
      dateOfBirth: s.date_of_birth,
      memories: memoryRows,
      littleThings: (littleThings ?? []).map((lt) => ({
        category: lt.category, value: lt.value, recorded: lt.recorded_date,
      })),
      books: (books ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        year: b.year_number,
        pdf: b.digital_pdf_path ? `${slug(s.display_name)}/books/${slug(b.title)}.pdf` : null,
      })),
    });
  }

  entries.push({ path: "manifest.json", contents: JSON.stringify(manifest, null, 2) });
  entries.push({ path: "README.txt", contents: EXPORT_NOTE });

  return { entries, manifest };
}
