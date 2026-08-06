// Prove the export produces a real, openable zip with the folder tree promised.
import { collectArchive } from "/home/user/curieux/ordinary-tuesday/src/lib/privacy/export";
import { writeFileSync } from "node:fs";
import { PassThrough } from "node:stream";

const memories = [
  { id: "m1", type: "photo", raw_text: "Yellow boots at the museum", transcript: null,
    memory_date: "2027-03-14", created_at: "2027-03-15", created_by: "u1",
    contribution_status: "approved", media_assets: [{ storage_path: "demo/1.svg", mime_type: "image/jpeg" }] },
  { id: "m2", type: "quote", raw_text: "I do it myself", transcript: null,
    memory_date: "2027-11-02", created_at: "2027-11-02", created_by: "u2",
    contribution_status: "approved", media_assets: [] },
];

const db: any = {
  from(table: string) {
    const q: any = {
      _t: table, select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; },
      then: (r: any) => Promise.resolve({
        data: table === "subjects" ? [{ id: "s1", display_name: "Florence", date_of_birth: "2025-04-14" }]
            : table === "memories" ? memories
            : table === "little_things" ? [{ category: "food", value: "strawberries", recorded_date: "2027-05-01" }]
            : table === "books" ? [{ id: "b1", title: "The Year You Were Two", year_number: 2, digital_pdf_path: "renders/b1.pdf" }]
            : [],
      }).then(r),
    };
    return q;
  },
};

async function main() {
  const { entries, manifest } = await collectArchive(db, "fam1");
  console.log("--- folder tree a parent would see ---");
  for (const e of entries) console.log("  " + e.path);
  console.log("\nmanifest subjects:", manifest.subjects.length,
              "| memories:", manifest.subjects[0].memories.length,
              "| books:", manifest.subjects[0].books.length);

  // Now actually zip the inline entries and confirm the file is a valid zip.
  const { ZipArchive } = await import("archiver");
  const zip: any = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  const finished = new Promise<void>((res, rej) => {
    zip.on("data", (c: Buffer) => chunks.push(c));
    zip.on("end", () => res());
    zip.on("error", rej);
  });
  for (const e of entries) if (e.contents !== undefined) zip.append(e.contents, { name: e.path });
  await zip.finalize();
  await finished;
  const buf = Buffer.concat(chunks);
  writeFileSync("/tmp/claude-0/-home-user-curieux/9e32ec0b-ca54-54fe-b9e4-51daca31e9b5/scratchpad/probe.zip", buf);
  console.log("\nzip bytes:", buf.length, "| magic:", buf.subarray(0, 2).toString());
}
main();
