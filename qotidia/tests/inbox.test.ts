// The Memory Inbox.
//
// Two things are being tested, and the first matters more than it looks.
//
// **That the inbox stays empty.** Capture that takes more than a few seconds
// is capture that stops happening, and an inbox that fills up with twenty
// items after a birthday has turned sharing into a chore. Almost every test
// below about triage is really a test that we did not ask a question.
//
// **That the address is treated as a credential.** It is the one thing in
// this product that gets printed on a screen and typed into other people's
// phones, and anybody who has it can write into a child's archive.

import { describe, expect, it } from "vitest";
import { fileArrival, needsFiling, normaliseAddress, verdictForSender } from "@/lib/inbox/triage";
import { addressFor, hintFor, newToken, tokenFrom, tokenMatches } from "@/lib/inbox/address";
import { trimQuoted } from "@/lib/inbox/mail";
import { takenOn } from "@/lib/media/taken";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

const ARRIVED = "2026-08-06T09:15:00Z";

describe("what needs asking", () => {
  it("asks nothing about a photograph that carries its own date", () => {
    const filed = fileArrival({
      type: "photo",
      captureTimestamp: "2025-11-02T14:00:00Z",
      arrivedAt: ARRIVED,
      via: "share",
    });
    expect(filed.memoryDate).toBe("2025-11-02");
    expect(filed.question).toBeNull();
  });

  it("asks nothing about a quote typed in just now", () => {
    // The day it arrived is the day it happened. Asking would be asking
    // somebody to confirm something they had done thirty seconds earlier.
    const filed = fileArrival({ type: "quote", arrivedAt: ARRIVED, via: "quick" });
    expect(filed.memoryDate).toBe("2026-08-06");
    expect(filed.question).toBeNull();
  });

  it("refuses to date an undated photograph rather than stamping today on it", () => {
    // A picture from 2019 shared this afternoon is not from this afternoon.
    // Stamping today moves a memory into the wrong year and the wrong book,
    // and nothing downstream can tell later that it was a guess.
    const filed = fileArrival({ type: "photo", arrivedAt: ARRIVED, via: "share" });
    expect(filed.memoryDate).toBeNull();
    expect(filed.question).toBe("Roughly when was this?");
  });

  it("leaves the ordinary case out of the inbox entirely", () => {
    const dated = { type: "photo", captureTimestamp: "2026-01-01T00:00:00Z", arrivedAt: ARRIVED, via: "share" as const };
    expect(needsFiling(dated)).toBe(false);
    expect(needsFiling({ type: "text", arrivedAt: ARRIVED, via: "email" })).toBe(false);
  });
});

describe("when a photograph was taken", () => {
  /** A minimal JPEG carrying one EXIF tag, built rather than fixtured. */
  function jpegWithDate(stamp: string): Buffer {
    const ascii = Buffer.from(`${stamp}\0`, "latin1");
    const entries = 2;
    // IFD0: one entry pointing at the Exif sub-IFD, then the sub-IFD itself.
    const ifd0 = Buffer.alloc(2 + 12 + 4);
    ifd0.writeUInt16LE(1, 0);
    ifd0.writeUInt16LE(0x8769, 2); // ExifOffset
    ifd0.writeUInt16LE(4, 4); // LONG
    ifd0.writeUInt32LE(1, 6);
    ifd0.writeUInt32LE(8 + ifd0.length, 10);

    const sub = Buffer.alloc(2 + 12 * (entries - 1) + 4);
    sub.writeUInt16LE(1, 0);
    sub.writeUInt16LE(0x9003, 2); // DateTimeOriginal
    sub.writeUInt16LE(2, 4); // ASCII
    sub.writeUInt32LE(ascii.length, 6);
    sub.writeUInt32LE(8 + ifd0.length + sub.length, 10);

    const header = Buffer.alloc(8);
    header.write("II", 0, "latin1");
    header.writeUInt16LE(0x002a, 2);
    header.writeUInt32LE(8, 4);

    const tiff = Buffer.concat([header, ifd0, sub, ascii]);
    const app1 = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
    const size = Buffer.alloc(2);
    size.writeUInt16BE(app1.length + 2, 0);

    return Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      size,
      app1,
      Buffer.from([0xff, 0xd9]),
    ]);
  }

  it("reads the date out of a photograph", () => {
    expect(takenOn(jpegWithDate("2025:11:02 14:22:31"), new Date("2026-08-06"))).toBe("2025-11-02");
  });

  it("says nothing about a file with no EXIF at all", () => {
    expect(takenOn(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), new Date("2026-08-06"))).toBeNull();
  });

  it("refuses a camera with a flat battery", () => {
    // Cameras that lose their clock cheerfully stamp 1980, and an archive
    // that adopts that has moved a memory forty years.
    expect(takenOn(jpegWithDate("1980:01:01 00:00:00"), new Date("2026-08-06"))).toBeNull();
  });

  it("refuses a date in the future", () => {
    expect(takenOn(jpegWithDate("2030:01:01 00:00:00"), new Date("2026-08-06"))).toBeNull();
  });

  it("returns null rather than throwing on a truncated file", () => {
    // These are bytes a stranger emailed in. A malformed one must not fail
    // the scan job, whose real work is deciding whether they may be served.
    const truncated = jpegWithDate("2025:11:02 14:22:31").subarray(0, 14);
    expect(() => takenOn(truncated)).not.toThrow();
    expect(takenOn(truncated)).toBeNull();
  });

  it("is not fooled by something that merely starts like a JPEG", () => {
    const junk = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(200, 0x41)]);
    expect(takenOn(junk)).toBeNull();
  });
});

describe("the private address", () => {
  it("is long enough that nobody guesses it", () => {
    expect(newToken().length).toBeGreaterThanOrEqual(24);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newToken()));
    expect(tokens.size).toBe(50);
  });

  it("cannot be derived from anything about the family", () => {
    // The hint is cosmetic and is never what gets checked. A person who
    // knows the child's name and birthday must be no closer to the address.
    const token = newToken();
    expect(addressFor(token, "Florence")).toContain(token);
    expect(tokenFrom(addressFor(token, "Florence"))).toBe(token);
    expect(tokenFrom(addressFor(token, "Rafi"))).toBe(token);
  });

  it("survives a name it cannot make a hint out of", () => {
    const token = newToken();
    expect(hintFor("李")).toBe("");
    expect(tokenFrom(addressFor(token, "李"))).toBe(token);
  });

  it("strips accents rather than emitting them into an address", () => {
    expect(hintFor("Zoë")).toBe("zoe");
  });

  it("resolves an address a mail system has rewritten", () => {
    const token = newToken();
    const address = addressFor(token, "Florence");
    expect(tokenFrom(address.toUpperCase())).toBe(token);
    expect(tokenFrom(address.replace("@", "+notes@"))).toBe(token);
  });

  it("compares tokens without throwing on a length mismatch", () => {
    // The comparison is against attacker-supplied input, so it is hashed to
    // a fixed length first — a four-character guess must not crash the
    // endpoint, and must not reveal the real length either.
    const token = newToken();
    expect(tokenMatches(token, token)).toBe(true);
    expect(tokenMatches("abc", token)).toBe(false);
    expect(tokenMatches(`${token}x`, token)).toBe(false);
  });
});

describe("who may write into an archive by mail", () => {
  const family = { familyAddresses: ["mum@example.com", "gran@example.com"], acceptFromAnyone: false };

  it("lets the family straight in", () => {
    expect(verdictForSender("Grandma <gran@example.com>", family)).toBe("accept");
    expect(verdictForSender("MUM@EXAMPLE.COM", family)).toBe("accept");
  });

  it("turns a stranger away by default", () => {
    // The privacy brief's rule was to invite people individually rather than
    // generate something anyone can post to. An address that accepts
    // anything from anyone is that with extra steps.
    expect(verdictForSender("someone@elsewhere.com", family)).toBe("refuse");
  });

  it("sends a stranger to the review queue once a family opts in", () => {
    expect(
      verdictForSender("someone@elsewhere.com", { ...family, acceptFromAnyone: true })
    ).toBe("review");
  });

  it("refuses a From header it cannot read as an address", () => {
    expect(verdictForSender("not an address", family)).toBe("refuse");
    expect(verdictForSender("", family)).toBe("refuse");
  });

  it("reads the address inside the angle brackets, not the first @ it finds", () => {
    // Display names can contain an @ of their own, and taking the first one
    // would let "mum@example.com <attacker@elsewhere.com>" walk in.
    expect(normaliseAddress('"mum@example.com" <attacker@elsewhere.com>')).toBe(
      "attacker@elsewhere.com"
    );
    expect(verdictForSender('"mum@example.com" <attacker@elsewhere.com>', family)).toBe("refuse");
  });
});

describe("reading a mail as a memory", () => {
  it("keeps what somebody typed and drops the thread under it", () => {
    const body = [
      "She said 'I do it my byself' this morning.",
      "",
      "On Tue, 4 Aug 2026, Mum wrote:",
      "> did she nap?",
    ].join("\n");
    expect(trimQuoted(body)).toBe("She said 'I do it my byself' this morning.");
  });

  it("drops a signature", () => {
    expect(trimQuoted("Look at this.\n\n--\nTom\n0400 000 000")).toBe("Look at this.");
  });

  it("drops the phone's boast", () => {
    // A book that prints "Sent from my iPhone" is a book somebody is
    // embarrassed by, and the embarrassment arrives a year later, bound.
    expect(trimQuoted("First swim!\n\nSent from my iPhone")).toBe("First swim!");
  });

  it("leaves an ordinary message alone", () => {
    expect(trimQuoted("Two lines.\nBoth of them hers.")).toBe("Two lines.\nBoth of them hers.");
  });
});

describe("the doors themselves", () => {
  // Static checks, in the style the serving gate uses. The failure guarded
  // against is somebody adding a third door and not knowing what the first
  // two had to do — which no unit test reaches, because the thing being
  // tested is an endpoint's first three lines.

  it("authenticates the mail webhook before parsing anything from it", () => {
    const code = read("src/app/api/inbox/email/route.ts");
    const body = code.slice(code.indexOf("export async function POST"));
    const authAt = body.indexOf("secretMatches");
    const parseAt = body.indexOf("req.json()");
    expect(authAt).toBeGreaterThan(-1);
    // An endpoint that parses attacker-supplied input before authenticating
    // it is an endpoint anybody who finds the URL can attack.
    expect(authAt).toBeLessThan(parseAt);
  });

  it("treats an unset webhook secret as bolted, not open", () => {
    const code = read("src/app/api/inbox/email/route.ts");
    expect(code).toMatch(/if \(!expected \|\| !presented\) return false/);
  });

  it("compares both secrets in constant time", () => {
    expect(read("src/app/api/inbox/email/route.ts")).toContain("timingSafeEqual");
    expect(read("src/lib/inbox/address.ts")).toContain("timingSafeEqual");
  });

  it("requires a signed-in person for the share sheet", () => {
    const code = read("src/app/api/inbox/share/route.ts");
    expect(code).toContain("currentUser");
    expect(code).toMatch(/if \(!user\)/);
  });

  it("scans everything that arrives, whichever door it came through", () => {
    // Both doors go through receive(), which is the entire reason it exists:
    // two capture paths doing their own uploads is two paths that drift, and
    // the one that drifts is the one that stops scanning attachments.
    const receive = read("src/lib/inbox/receive.ts");
    expect(receive).toContain('"scan_asset"');
    for (const door of ["share", "email"]) {
      expect(read(`src/app/api/inbox/${door}/route.ts`)).toContain("receive(");
    }
  });
});
