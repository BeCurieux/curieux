// Malware scanning, behind the same adapter shape as AI, print and email.
//
// Type verification (verify.ts) and malware scanning answer different
// questions and both are needed. Verification asks "is this the kind of file
// it claims to be" — it catches the HTML-named-as-a-JPEG case, which is the
// one that actually threatens this product, because our files come back to
// browsers through signed URLs. Scanning asks "is this a file someone else
// will be harmed by" — a real JPEG carrying a real payload passes every
// structural check there is, and a parent may well download it years later
// onto a machine that is not this one.
//
// Neither is a substitute for the other, so both run.

import { connect } from "node:net";

export interface ScanResult {
  infected: boolean;
  /** The signature name, when there is one. Recorded, never shown raw. */
  signature: string | null;
}

export interface MalwareScanner {
  readonly name: string;
  scan(bytes: Buffer): Promise<ScanResult>;
}

/**
 * The EICAR test string — the industry's standard harmless stand-in, which
 * every real scanner is required to flag. Having it here means the mock and
 * a real clamd agree on at least one file, so the wiring can be tested
 * without shipping actual malware into a test fixture.
 */
export const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/**
 * The default. Flags EICAR and nothing else.
 *
 * Named for what it is. A mock scanner that reports every file clean is
 * indistinguishable from a real one until the day it matters, so nothing
 * anywhere is allowed to describe this as "scanned" — see scannerIsReal().
 */
export class MockScanner implements MalwareScanner {
  readonly name = "mock";
  async scan(bytes: Buffer): Promise<ScanResult> {
    const infected = bytes.toString("latin1", 0, 1024).includes(EICAR);
    return { infected, signature: infected ? "Eicar-Test-Signature" : null };
  }
}

/**
 * ClamAV over its INSTREAM protocol.
 *
 * Streaming rather than handing over a path, because clamd usually runs in a
 * different container and sharing a filesystem with it to scan a customer's
 * photographs is a worse trade than sending the bytes.
 */
export class ClamdScanner implements MalwareScanner {
  readonly name = "clamd";

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 30_000
  ) {}

  scan(bytes: Buffer): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(this.timeoutMs, () => fail(new Error("clamd timed out")));
      socket.on("error", fail);
      socket.on("data", (d) => chunks.push(d));

      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        // Chunked as <4-byte big-endian length><bytes>, terminated by a zero
        // length. clamd's default StreamMaxLength is 25MB; a phone photo is
        // well inside it and a chunk over it is refused by the daemon rather
        // than by us, which is the right place for that limit to live.
        for (let at = 0; at < bytes.length; at += 64 * 1024) {
          const chunk = bytes.subarray(at, at + 64 * 1024);
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length);
          socket.write(header);
          socket.write(chunk);
        }
        socket.write(Buffer.from([0, 0, 0, 0]));
      });

      socket.on("close", () => {
        if (settled) return;
        settled = true;
        const reply = Buffer.concat(chunks).toString("utf8").trim();
        // "stream: OK" or "stream: <Signature> FOUND", or an ERROR line.
        if (/\bOK$/.test(reply)) return resolve({ infected: false, signature: null });
        const found = reply.match(/stream:\s*(.+?)\s+FOUND$/);
        if (found) return resolve({ infected: true, signature: found[1] });
        reject(new Error(`clamd said: ${reply || "nothing"}`));
      });
    });
  }
}

/**
 * The configured scanner. Real when CLAMD_HOST is set, mock otherwise —
 * the same explicit-opt-in shape the other providers use, so a missing
 * environment variable degrades to something obviously fake rather than to
 * something that looks real and checks nothing.
 */
export function getScanner(): MalwareScanner {
  const host = process.env.CLAMD_HOST;
  if (!host) return new MockScanner();
  return new ClamdScanner(host, Number(process.env.CLAMD_PORT ?? 3310));
}

/**
 * Whether the configured scanner is a real one.
 *
 * Used by the privacy page. "We scan every upload for malware" is a promise,
 * and a promise backed by MockScanner is a lie — so the sentence is only
 * printed when this is true.
 */
export function scannerIsReal(): boolean {
  return getScanner().name !== "mock";
}
