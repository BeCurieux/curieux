// Signature Version 4, for presigned URLs.
//
// Cloudflare R2, Backblaze B2, MinIO and S3 itself all speak the same
// protocol, and the part of it we need is small: turn a request into a URL
// that carries its own authorisation and stops working after a while.
//
// ## Why this is written out rather than installed
//
// The obvious move is @aws-sdk/client-s3 plus @aws-sdk/s3-request-presigner.
// That is a large dependency tree in a server bundle for one algorithm we
// use in one direction, and it brings a credential-resolution chain that
// reads environment variables, instance metadata endpoints and profile files
// — machinery this product does not want anywhere near a bucket holding
// children's photographs.
//
// The reason it is *safe* to write out is that it is checkable. AWS
// publishes a worked example with a fixed key, a fixed clock and the exact
// signature it must produce, and sigv4.test.ts runs it. A hand-rolled
// crypto-adjacent routine with no test vector would be a bad trade; one that
// reproduces the published answer to the character is a different thing.
//
// Nothing here is R2-specific. It signs; r2.ts decides what to sign.

import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";

/**
 * A presigned request carries its payload hash as the literal string
 * UNSIGNED-PAYLOAD. It has to: the whole point is to hand the URL to a
 * browser that will stream a file we have never seen, so the body cannot be
 * hashed in advance.
 *
 * The size still can be pinned — see signedHeaders in presign, and the
 * content-length note in r2.ts. That distinction matters: we cannot know
 * *what* is uploaded, but we can insist on *how much*.
 */
const UNSIGNED = "UNSIGNED-PAYLOAD";

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export interface PresignInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  /** Origin with no trailing slash, e.g. https://abc123.r2.cloudflarestorage.com */
  origin: string;
  /** Object key, unencoded — "family/child/photo (1).jpg" is fine. */
  key: string;
  expiresInSeconds: number;
  /** Extra query parameters, e.g. response-content-disposition. */
  query?: Record<string, string>;
  /**
   * Headers the caller must send exactly as given. Signing a header binds
   * its value — a request that sends something else is refused, which is how
   * content-length becomes a limit rather than a suggestion.
   *
   * Host is always signed and need not be passed.
   */
  signedHeaders?: Record<string, string>;
  /** Injected so tests can use the published example's clock. */
  now?: Date;
}

/**
 * Percent-encoding as the signing algorithm defines it, which is not what
 * encodeURIComponent does.
 *
 * Two differences, both of which produce a signature mismatch rather than an
 * error message: !'()* must be escaped, and in a path (encodeSlash false) a
 * / must not be. A key with an apostrophe in it — "nanna's birthday.jpg" —
 * is exactly the sort of thing a family types and a test does not.
 */
export function uriEncode(value: string, encodeSlash = true): string {
  let out = "";
  for (const ch of Buffer.from(value, "utf8")) {
    const c = String.fromCharCode(ch);
    if (/[A-Za-z0-9\-._~]/.test(c)) {
      out += c;
    } else if (c === "/") {
      out += encodeSlash ? "%2F" : "/";
    } else {
      out += "%" + ch.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** Timestamps in the two shapes the algorithm wants: 20130524T000000Z and 20130524. */
function stamps(now: Date): { long: string; short: string } {
  const long = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { long, short: long.slice(0, 8) };
}

/**
 * The signing key: four nested HMACs, each rekeying with the last. This is
 * what makes a leaked signature useless tomorrow, in another region, for
 * another service — the key itself is scoped, not just the signature.
 */
export function signingKey(secret: string, short: string, region: string, service: string): Buffer {
  const date = hmac(`AWS4${secret}`, short);
  const reg = hmac(date, region);
  const svc = hmac(reg, service);
  return hmac(svc, "aws4_request");
}

/** A URL that authorises exactly one request, for a while. */
export function presign(creds: Credentials, input: PresignInput): string {
  const now = input.now ?? new Date();
  const { long, short } = stamps(now);
  const scope = `${short}/${creds.region}/${creds.service}/aws4_request`;

  const host = new URL(input.origin).host;
  const headers: Record<string, string> = { host, ...(input.signedHeaders ?? {}) };

  // Lowercased names, sorted, values trimmed. Sorting is on the name and the
  // canonical list must agree with what is sent, or the signature is for a
  // different request than the one that arrives.
  const names = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders =
    names
      .map((n) => {
        const key = Object.keys(headers).find((h) => h.toLowerCase() === n)!;
        return `${n}:${String(headers[key]).trim().replace(/\s+/g, " ")}`;
      })
      .join("\n") + "\n";
  const signedHeaderList = names.join(";");

  const params: Record<string, string> = {
    ...(input.query ?? {}),
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": long,
    "X-Amz-Expires": String(input.expiresInSeconds),
    "X-Amz-SignedHeaders": signedHeaderList,
  };

  // Sorted by encoded name, and both sides encoded. This is the step where a
  // response-content-disposition carrying a filename with a space goes wrong
  // if encodeURIComponent is used instead of uriEncode.
  const canonicalQuery = Object.keys(params)
    .map((k) => [uriEncode(k), uriEncode(params[k])] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalPath =
    "/" +
    input.key
      .split("/")
      .map((seg) => uriEncode(seg))
      .join("/");

  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    UNSIGNED,
  ].join("\n");

  const stringToSign = [ALGORITHM, long, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(creds.secretAccessKey, short, creds.region, creds.service)
  )
    .update(stringToSign)
    .digest("hex");

  return `${input.origin}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
