// The press pass, checked against real files rather than a mocked one.
//
// Every claim this module makes is a claim about a PDF a printer will open,
// so nothing here asserts on what Ghostscript was *asked* to do. The
// round-trip tests build an actual PDF, run the pass over it, and read the
// markers back out of the bytes that come back.
//
// The fixture deliberately carries /Title (about:blank), because Chromium's
// output does. An earlier version of this file did not, and the suite passed
// while the real book still went out titled "about:blank" — the input's own
// DocInfo was overwriting ours. A fixture that is easier than the real input
// is worse than no fixture.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { FORMAT } from "@/lib/book/format";
import {
  ghostscriptAvailable,
  inspect,
  PDF_STANDARD,
  toPressReady,
} from "@/lib/pdf/pdfx";

const run = promisify(execFile);
const hasGs = await ghostscriptAvailable();

/** A real two-page PDF with real type on it, made without the book renderer. */
async function samplePdf(): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "pdfx-fixture-"));
  try {
    const ps = join(dir, "in.ps");
    const out = join(dir, "out.pdf");
    await writeFile(
      ps,
      `[ /Title (about:blank) /DOCINFO pdfmark
[ /Creator (Mozilla/5.0) /DOCINFO pdfmark
/Times-Roman findfont 24 scalefont setfont
72 700 moveto (florence) show showpage
/Times-Roman findfont 24 scalefont setfont
72 700 moveto (the year you were two) show showpage
`
    );
    await run("gs", [
      "-dBATCH", "-dNOPAUSE", "-q",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-sOutputFile=${out}`,
      ps,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("reading a PDF's markers back out", () => {
  it("reports nothing rather than guessing when handed something that isn't a PDF", () => {
    const found = inspect(Buffer.from("this is not a pdf"));
    expect(found.version).toBe("unknown");
    expect(found.hasOutputIntent).toBe(false);
    expect(found.embeddedFonts).toBe(0);
    expect(found.pageCount).toBe(0);
    expect(found.title).toBeNull();
  });

  it("counts pages without counting the /Pages tree node as one of them", () => {
    // The tree node is /Type /Pages — one character away from a page, and
    // counting it would silently inflate every page count by one.
    const fake = Buffer.from(
      "%PDF-1.4\n/Type /Pages /Count 2\n/Type /Page /Parent\n/Type /Page /Parent\n"
    );
    expect(inspect(fake).pageCount).toBe(2);
  });

  it("reads a title in either of the forms a PDF may carry it", () => {
    const plain = Buffer.from("%PDF-1.6\n/Title (Florence: The Year You Were Two)\n");
    expect(inspect(plain).title).toBe("Florence: The Year You Were Two");

    // UTF-16BE with a BOM, as hex — the spec's form for anything non-ASCII.
    const hex = Buffer.from("%PDF-1.6\n/Title <FEFF005A006F00EB>\n");
    expect(inspect(hex).title).toBe("Zoë");

    // The same bytes as a literal string with octal escapes, which is what
    // pdfwrite actually re-emits our hex string as.
    const octal = Buffer.from("%PDF-1.6\n/Title (\\376\\377\\000Z\\000o\\000\\353)\n");
    expect(inspect(octal).title).toBe("Zoë");
  });

  it("unescapes a bracket in a title rather than reporting the backslash", () => {
    const s = Buffer.from("%PDF-1.6\n/Title (flo :\\) the year)\n");
    expect(inspect(s).title).toBe("flo :) the year");
  });
});

describe("what the pipeline claims to produce", () => {
  it("is what the format constants say, so the two cannot drift apart", () => {
    expect(FORMAT.pdfStandard).toBe(PDF_STANDARD);
  });

  it("does not claim PDF/X, which this toolchain cannot produce in RGB", () => {
    // Ghostscript's X mode refuses any colour conversion other than
    // DeviceGray or DeviceCMYK. Claiming X-4 on an RGB file would mislead a
    // printer that trusted the marker.
    expect(FORMAT.pdfStandard).not.toMatch(/PDF\/X/);
    expect(FORMAT.colourSpace).toBe("RGB");
  });
});

describe.skipIf(!hasGs)("the press pass, over a real file", () => {
  it("lifts the version, attaches an intent, and loses neither pages nor fonts", async () => {
    const input = await samplePdf();
    const before = inspect(input);
    expect(before.version).toBe("1.4");
    expect(before.hasOutputIntent).toBe(false);
    expect(before.pageCount).toBe(2);

    const after = await toPressReady(input, "Florence: The Year You Were Two");

    expect(after.version).toBe("1.6");
    expect(after.hasOutputIntent).toBe(true);
    expect(after.pageCount).toBe(before.pageCount);
    expect(after.embeddedFonts).toBeGreaterThan(0);
    // Read from the bytes as well as the returned summary — the summary is
    // only trustworthy if it describes the buffer it came with.
    const { bytes, ...summary } = after;
    expect(inspect(bytes)).toEqual(summary);
  }, 60_000);

  it("replaces the title Chromium left, rather than adding one beside it", async () => {
    // "about:blank" is what a print operator would otherwise see in their
    // queue next to a child's book.
    const input = await samplePdf();
    expect(inspect(input).title).toBe("about:blank");

    const { bytes, title } = await toPressReady(input, "Florence: The Year You Were Two");
    expect(title).toBe("Florence: The Year You Were Two");
    expect(bytes.toString("latin1")).not.toContain("about:blank");
  }, 60_000);

  it("carries a name that isn't ASCII through intact", async () => {
    // Written as UTF-8 in a plain string, Zoë arrives as ZoÃ«.
    const { title } = await toPressReady(await samplePdf(), "Zoë — The Year You Were Two");
    expect(title).toBe("Zoë — The Year You Were Two");
  }, 60_000);

  it("survives a title carrying the characters that end a PostScript string", async () => {
    // Titles come from a parent's typing, and an unmatched closing bracket
    // would otherwise break the prologue rather than the title.
    const { title, hasOutputIntent } = await toPressReady(
      await samplePdf(),
      "flo :) the year \\ everything"
    );
    expect(hasOutputIntent).toBe(true);
    expect(title).toBe("flo :) the year \\ everything");
  }, 60_000);

  it("refuses a file it cannot process rather than passing it through", async () => {
    await expect(toPressReady(Buffer.from("not a pdf at all"), "nothing")).rejects.toThrow();
  }, 60_000);
});
