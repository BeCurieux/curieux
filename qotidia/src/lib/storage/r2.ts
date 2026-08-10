// Cloudflare R2.
//
// S3's protocol without S3's egress bill. That is the entire reason it is
// here: per-gigabyte storage prices across providers are within a rounding
// error of each other, and egress is not. Every time a parent opens their
// archive, every book render, every export reads objects back out — and on a
// metered store that is a cost that grows with how much people love the
// product. On R2 it is zero.
//
// ## Two buckets, one account
//
// R2 addresses buckets by path — {origin}/{bucket}/{key} — using the
// account-scoped endpoint. No virtual-host style, no per-bucket subdomain,
// and no DNS to set up.
//
// ## What this deliberately does not do
//
//   **No public bucket, ever.** R2 will happily attach a public r2.dev URL
//   or a custom domain to a bucket. Doing that to this one would make every
//   photograph in it fetchable by anyone with the key, permanently, with no
//   way to take it back short of moving the object. Every read here is
//   signed and short-lived.
//
//   **No credential chain.** The AWS SDK resolves credentials from
//   environment variables, then profile files, then an instance metadata
//   endpoint over HTTP. That last one is a documented way to get a
//   compromised server to hand out keys. These come from two named
//   variables and nowhere else.
//
//   **No bucket-level access control.** R2 has none worth relying on, and
//   pretending otherwise would be worse than knowing it. Permission is
//   decided in the application against the database before a URL exists.

import { presign, type Credentials } from "./sigv4";
import type { Bucket, ObjectStore, WriteTicket } from "./provider";

/**
 * R2 ignores the region but the signature does not — it is part of the
 * scoped signing key, so both sides have to say the same word. Cloudflare's
 * word is "auto".
 */
const REGION = "auto";

function config(): { origin: string; creds: Credentials } {
  const account = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  // Named, not asserted. Whoever hits this is configuring storage for the
  // first time, and "Cannot read properties of undefined" would tell them
  // neither which setting nor which file.
  const missing = [
    !account && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `STORAGE_PROVIDER is "r2" but ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} not set. ` +
        `Add them to .env.local — see SETUP.md.`
    );
  }

  return {
    // Overridable so this can be pointed at MinIO or any other S3-compatible
    // server, which is also how it gets tested against something real.
    //
    // `||` and not `??` throughout this file. A variable present but blank —
    // which is exactly what copying .env.example and filling in only some of
    // it produces — is undefined for our purposes, and `??` would take the
    // empty string and build requests against an origin of "".
    origin: process.env.R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`,
    creds: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, region: REGION, service: "s3" },
  };
}

/** Bucket names may be overridden, because R2 buckets are global per account. */
const bucketName = (bucket: Bucket): string =>
  bucket === "media"
    ? process.env.R2_MEDIA_BUCKET || "qotidia-media"
    : process.env.R2_RENDERS_BUCKET || "qotidia-renders";

const objectKey = (bucket: Bucket, key: string) => `${bucketName(bucket)}/${key}`;

export class R2Store implements ObjectStore {
  readonly name = "r2";

  async readUrl(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts?: { downloadAs?: string }
  ): Promise<string> {
    const { origin, creds } = config();
    return presign(creds, {
      method: "GET",
      origin,
      key: objectKey(bucket, key),
      expiresInSeconds: ttlSeconds,
      query: opts?.downloadAs
        ? { "response-content-disposition": `attachment; filename="${sanitise(opts.downloadAs)}"` }
        : undefined,
    });
  }

  async writeTicket(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts: { contentType: string; contentLength: number }
  ): Promise<WriteTicket> {
    const { origin, creds } = config();

    // content-length is signed, which is the point. The browser tells us a
    // file is four megabytes, the quota is checked against four megabytes,
    // and this makes four megabytes the most it can actually send — a
    // request with any other length has a signature for a different
    // request and R2 refuses it. Without this the storage limit is a
    // suggestion that a modified client can ignore.
    const headers = {
      "content-length": String(opts.contentLength),
      "content-type": opts.contentType,
    };

    return {
      url: presign(creds, {
        method: "PUT",
        origin,
        key: objectKey(bucket, key),
        expiresInSeconds: ttlSeconds,
        signedHeaders: headers,
      }),
      method: "PUT",
      headers,
    };
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    const { origin, creds } = config();
    const url = presign(creds, {
      method: "PUT",
      origin,
      key: objectKey(bucket, key),
      expiresInSeconds: 300,
      signedHeaders: { "content-length": String(body.length), "content-type": contentType },
    });

    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-length": String(body.length), "content-type": contentType },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      throw new Error(`could not write ${bucket}/${key}: ${res.status} ${await safeBody(res)}`);
    }
  }

  async get(bucket: Bucket, key: string): Promise<Buffer> {
    const url = await this.readUrl(bucket, key, 60);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`could not read ${bucket}/${key}: ${res.status} ${await safeBody(res)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(bucket: Bucket, keys: string[]): Promise<void> {
    const { origin, creds } = config();

    // One request per key rather than the batch DeleteObjects call. That one
    // wants a signed XML body, and the payload hash it needs is exactly what
    // a presigned URL cannot carry. Deletes are rare and never on a path
    // anybody is waiting on — erasing a family's archive is a background job
    // — so the simpler thing that is obviously correct wins.
    //
    // Bounded concurrency: a full erase can be tens of thousands of objects
    // and firing them all at once is how a cleanup job takes out its own
    // event loop.
    const queue = [...keys];
    const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        const url = presign(creds, {
          method: "DELETE",
          origin,
          key: objectKey(bucket, next),
          expiresInSeconds: 300,
        });
        const res = await fetch(url, { method: "DELETE" });
        // 404 is success. Deleting a file that is already gone is what a
        // retried job does, and it must not fail the retry.
        if (!res.ok && res.status !== 404) {
          throw new Error(`could not delete ${bucket}/${next}: ${res.status} ${await safeBody(res)}`);
        }
      }
    });
    await Promise.all(workers);
  }
}

/**
 * A filename safe to put inside a quoted header value.
 *
 * Quotes, backslashes and newlines out. A newline in a response header is
 * header injection, and the filename can come from user-controlled data.
 */
function sanitise(filename: string): string {
  return filename.replace(/[\r\n"\\]/g, "").slice(0, 200) || "download";
}

/** Error bodies are XML and can be long; enough to identify the problem. */
async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "(no body)";
  }
}
