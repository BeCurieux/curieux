// Does the R2 store work over a real socket?
//
// Run through ../verify-storage.sh, which starts the signature-checking
// stub first. See that script for why this exists alongside the unit tests.

// Points at scripts/storage/s3-stub.py, which validates every signature
// with botocore before answering. A wrong signature is a 403 here exactly
// as it would be from Cloudflare.
process.env.R2_ENDPOINT = "http://127.0.0.1:9111";
process.env.R2_ACCOUNT_ID = "acct";
process.env.R2_ACCESS_KEY_ID = "TESTACCESSKEY";
process.env.R2_SECRET_ACCESS_KEY = "TESTSECRETKEY0000000000000000000000000000";
process.env.R2_MEDIA_BUCKET = "qotidia-media";
process.env.R2_RENDERS_BUCKET = "qotidia-renders";

import { R2Store } from "@/lib/storage/r2";

const store = new R2Store();
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${ok || !detail ? "" : "\n        " + detail}`);
  if (!ok) failures++;
};

async function main() {
  // --- server-side put / get round trip, with a name a family would use
  const key = "fam-1/child-2/nanna's birthday (1).jpg";
  const body = Buffer.from("pretend jpeg bytes é\u{1F382}", "utf8");
  await store.put("media", key, body, "image/jpeg");
  const back = await store.get("media", key);
  check("put then get returns the same bytes", back.equals(body));

  // --- a read URL works, and stops working if edited
  const url = await store.readUrl("media", key, 300);
  const r1 = await fetch(url);
  check("a signed read URL is accepted", r1.status === 200);

  const tampered = url.replace(/X-Amz-Expires=300/, "X-Amz-Expires=86400");
  const r2 = await fetch(tampered);
  check("editing the expiry breaks it", r2.status === 403, `got ${r2.status}`);

  const otherKey = url.replace("child-2", "child-9");
  const r3 = await fetch(otherKey);
  check("pointing it at another key breaks it", r3.status === 403, `got ${r3.status}`);

  // --- download filename
  const dl = await store.readUrl("renders", "exports/e1.zip", 300, { downloadAs: "your archive.zip" });
  await store.put("renders", "exports/e1.zip", Buffer.from("zip"), "application/zip");
  const r4 = await fetch(dl);
  check("a download URL is accepted with a filename", r4.status === 200, `got ${r4.status}`);
  check("and carries the filename back",
    (r4.headers.get("content-disposition") ?? "").includes('filename="your archive.zip"'),
    r4.headers.get("content-disposition") ?? "(none)");

  // --- the browser upload ticket
  const file = Buffer.from("x".repeat(4096));
  const ticket = await store.writeTicket("media", "fam-1/upload.jpg", 900, {
    contentType: "image/jpeg", contentLength: file.length,
  });
  const up = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: new Uint8Array(file) });
  check("an upload ticket accepts exactly the declared size", up.status === 200, `got ${up.status}`);

  // --- THE one that matters: lying about the size
  const bigger = Buffer.from("x".repeat(40960));
  const lie = await fetch(ticket.url, {
    method: "PUT",
    headers: { ...ticket.headers, "content-length": String(bigger.length) },
    body: new Uint8Array(bigger),
  });
  check("sending more than declared is refused", lie.status === 403, `got ${lie.status}`);

  // A ticket is for one key only.
  const elsewhere = await fetch(ticket.url.replace("fam-1", "fam-2"), {
    method: "PUT", headers: ticket.headers, body: new Uint8Array(file),
  });
  check("an upload ticket cannot be aimed at another family", elsewhere.status === 403, `got ${elsewhere.status}`);

  // --- delete, and deleting twice
  await store.remove("media", [key]);
  let gone = false;
  try { await store.get("media", key); } catch { gone = true; }
  check("remove deletes the object", gone);
  let threw = false;
  try { await store.remove("media", [key]); } catch { threw = true; }
  check("deleting something already gone is not an error", !threw);

  // --- many at once, to exercise the worker pool
  const many = Array.from({ length: 25 }, (_, i) => `bulk/${i}.jpg`);
  for (const k of many) await store.put("media", k, Buffer.from(String(k)), "image/jpeg");
  await store.remove("media", many);
  let allGone = true;
  for (const k of many) { try { await store.get("media", k); allGone = false; } catch {} }
  check("a bulk delete removes all of them", allGone);

  console.log(failures === 0 ? "\nAll end-to-end checks passed." : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
