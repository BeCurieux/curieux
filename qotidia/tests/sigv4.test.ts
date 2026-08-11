// Is the signing right?
//
// This is the one module in the codebase where being subtly wrong produces
// no error anywhere near the mistake. A bad signature is a 403 from
// Cloudflare with a body that says SignatureDoesNotMatch and nothing about
// which of the fourteen steps disagreed. So it is not tested by reasoning
// about it — it is tested against answers computed by somebody else.
//
// Two independent sources:
//
//   **AWS's own published example.** Fixed key, fixed clock, and the exact
//   signature the algorithm must produce, printed in their documentation.
//   If this passes, the canonical request, the string to sign, the scoped
//   signing key and the final HMAC are all correct.
//
//   **botocore.** The ten vectors below were produced by Amazon's Python
//   implementation — S3SigV4QueryAuth — signing the same requests, and
//   pasted here. They are the cases the published example does not reach:
//   keys with apostrophes, spaces, brackets, accents, emoji, plus signs and
//   percent signs, which is to say the filenames families actually have.
//   "Nanna's birthday.jpg" is not a hypothetical.
//
// The vectors are frozen rather than recomputed so the suite needs no Python
// and no network. Regenerating them means re-running botocore, which is the
// point: they are evidence, not fixtures we chose.

import { describe, expect, it } from "vitest";
import { presign, uriEncode } from "@/lib/storage/sigv4";

const R2_ORIGIN = "https://acct123.r2.cloudflarestorage.com";
const DEMO = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

const signatureOf = (url: string) => new URL(url).searchParams.get("X-Amz-Signature");

describe("the signature AWS publishes", () => {
  it("is the signature we produce, to the character", () => {
    const url = presign(
      { ...DEMO, region: "us-east-1", service: "s3" },
      {
        method: "GET",
        origin: "https://examplebucket.s3.amazonaws.com",
        key: "test.txt",
        expiresInSeconds: 86400,
        now: new Date("2013-05-24T00:00:00Z"),
      }
    );
    expect(signatureOf(url)).toBe(
      "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    );
  });
});

describe("the names families actually give things", () => {
  // Produced by botocore 1.43.67, S3SigV4QueryAuth, region "auto", 900s.
  const AT = new Date("2026-08-09T23:39:15Z");
  const VECTORS: [key: string, signature: string][] = [
    ["media/plain.jpg", "781f56e1ab8072d1b1508d0cc3b869f006db118ae7636b4daf4899c14a5fe0bb"],
    ["media/nanna's birthday.jpg", "ec5035447b2047a3b161711c484ac182b46d325a87192838f67d45daac7d18ee"],
    ["media/first steps (1).jpg", "27e7fd08ba708cba464387e31fb4c09890f580443ee8ea65d639ed7644d8d8d3"],
    ["media/été à la plage.jpg", "4602f5ab180a2fce457506124672f3d27989f1ea5f6ebebec97be988f9fe3feb"],
    ["media/a+b&c=d.jpg", "23afa8df26dad0d48bef03615bfe6ff13b0ed4fbc5b665aa4cbcd65e572e6ddf"],
    ["media/100% done!.jpg", "09fa19c58212cd64df6b386c7911c1eb4281eb69a0308c88b0138fb9a1606b94"],
    ["media/deep/nested/path/to/thing.mp4", "94cd6b66b7848d7e2aca97321517efc8b6a84b840e4a6cb7e51560fc27f52e5b"],
    ["media/tilde~and.dots...jpg", "9e652fd44dee378eec90e49ecde72e231f498b6ae530717bf1e9ace3d1889e21"],
    ["media/emoji 🎂 cake.jpg", "d805936ca15c6e84be0c71e0d02c851e44fc10a5c84a20d722fa9dd1407f0c7a"],
    ["renders/books/abc/print-0123456789ab.pdf", "232442e665719356a9c2e9268c4dbbae34832e586500934343ca6de9287d07b7"],
  ];

  for (const [key, signature] of VECTORS) {
    it(`signs ${key} the way Amazon's own client does`, () => {
      const url = presign(
        { ...DEMO, region: "auto", service: "s3" },
        { method: "GET", origin: R2_ORIGIN, key, expiresInSeconds: 900, now: AT }
      );
      expect(signatureOf(url)).toBe(signature);
    });
  }
});

describe("encoding, which is where this goes wrong quietly", () => {
  it("escapes the characters encodeURIComponent leaves alone", () => {
    // !'()* are unreserved to JavaScript and reserved to the algorithm. A
    // photograph called "nanna's" is the whole bug.
    expect(uriEncode("!'()*")).toBe("%21%27%28%29%2A");
    expect(encodeURIComponent("!'()*")).toBe("!'()*");
  });

  it("leaves the four unreserved characters alone", () => {
    expect(uriEncode("AZaz09-._~")).toBe("AZaz09-._~");
  });

  it("encodes a slash in a query value but not in a path", () => {
    expect(uriEncode("a/b")).toBe("a%2Fb");
    expect(uriEncode("a/b", false)).toBe("a/b");
  });

  it("encodes a space as %20 and never as +", () => {
    expect(uriEncode("first steps")).toBe("first%20steps");
  });
});

describe("what a signed URL commits to", () => {
  const creds = { ...DEMO, region: "auto", service: "s3" };
  const base = {
    method: "PUT" as const,
    origin: R2_ORIGIN,
    key: "media/x.jpg",
    expiresInSeconds: 900,
    now: new Date("2026-08-09T23:39:15Z"),
  };

  it("binds a signed header, so sending something else is refused", () => {
    // This is what turns a declared upload size into an enforced one. The
    // browser tells us a file is 4MB, we sign content-length: 4194304, and a
    // request that streams four gigabytes has the wrong signature. Without
    // it, the quota is honour-based.
    const four = presign(creds, { ...base, signedHeaders: { "content-length": "4194304" } });
    const forty = presign(creds, { ...base, signedHeaders: { "content-length": "41943040" } });
    expect(signatureOf(four)).not.toBe(signatureOf(forty));
    expect(new URL(four).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;host");
  });

  it("signs the method, so a read URL cannot be used to write", () => {
    const read = presign(creds, { ...base, method: "GET" });
    const write = presign(creds, { ...base, method: "PUT" });
    expect(signatureOf(read)).not.toBe(signatureOf(write));
  });

  it("signs the expiry, so it cannot be extended by editing the URL", () => {
    const short = presign(creds, { ...base, expiresInSeconds: 300 });
    const long = presign(creds, { ...base, expiresInSeconds: 86400 });
    expect(signatureOf(short)).not.toBe(signatureOf(long));
  });

  it("signs the key, so one URL cannot fetch another family's object", () => {
    const ours = presign(creds, { ...base, key: "family-a/photo.jpg" });
    const theirs = presign(creds, { ...base, key: "family-b/photo.jpg" });
    expect(signatureOf(ours)).not.toBe(signatureOf(theirs));
  });

  it("carries a download filename without breaking the signature", () => {
    const url = presign(creds, {
      ...base,
      method: "GET",
      query: { "response-content-disposition": 'attachment; filename="your archive.zip"' },
    });
    // Encoded in the URL, and the same string went into the signature —
    // which only holds because the query is built once and reused.
    expect(url).toContain("response-content-disposition=attachment%3B%20filename%3D%22your%20archive.zip%22");
    expect(signatureOf(url)).toHaveLength(64);
  });

  it("sorts query parameters, because the algorithm requires it", () => {
    const url = new URL(presign(creds, { ...base, query: { zebra: "1", alpha: "2" } }));
    const names = [...url.searchParams.keys()].filter((n) => n !== "X-Amz-Signature");
    expect(names).toEqual([...names].sort());
  });
});
