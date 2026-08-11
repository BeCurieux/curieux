// Print-ready post-processing.
//
// This module started out as "make the PDF actually be PDF/X-4", because
// FORMAT.pdfStandard had claimed that from the beginning while the renderer
// produced PDF 1.4. Trying it produced a more useful finding than the fix:
//
//   **Ghostscript cannot produce an RGB PDF/X file at all.** Setting the
//   GTS_PDFXVersion marker puts it in X mode, and X mode refuses any
//   ColorConversionStrategy other than DeviceGray or DeviceCMYK. There is
//   no flag combination that gets around it.
//
// So the choice was: convert the book to CMYK to satisfy a standard, or stop
// claiming the standard. CMYK would have meant re-rendering a palette whose
// nineteen colours were each contrast-validated in RGB, to satisfy a
// requirement the printer does not impose — Prodigi accepts RGB PDFs at trim
// size. FORMAT now says what is true, and this does the parts of X-4 that
// were actually worth having:
//
//   PDF 1.6 rather than 1.4    -dCompatibilityLevel=1.6
//   an sRGB output intent      so a press knows what the colours meant
//   every font embedded        -dEmbedAllFonts, asserted afterwards
//   full-resolution images     downsampling off, or the 300dpi tiering the
//                              whole book is built around would be undone
//   a real document title      Chromium writes "about:blank", which is what
//                              a printer's operator sees in their queue
//
// Nothing is flattened. Flattening turns clean vector pages into bitmaps and
// quietly loses live text.

import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { BRAND } from "@/lib/brand";

const run = promisify(execFile);

/** Ghostscript's sRGB profile. Overridable for other environments. */
export const ICC_PROFILE =
  process.env.PDFX_ICC_PROFILE ?? "/usr/share/color/icc/ghostscript/srgb.icc";

/** What the pipeline actually produces, and what FORMAT should say. */
export const PDF_STANDARD = "PDF 1.6, RGB, sRGB output intent";

export interface PressReadyResult {
  bytes: Buffer;
  /** Read back out of the produced file, never assumed. */
  version: string;
  hasOutputIntent: boolean;
  embeddedFonts: number;
  pageCount: number;
  /** null when the file carries no title at all. */
  title: string | null;
}

/**
 * A title as a PDF text string, always UTF-16BE hex.
 *
 * A plain PostScript string looks fine and is wrong for any name outside
 * ASCII: Ghostscript passes the UTF-8 bytes straight through, a reader
 * decodes them as PDFDocEncoding, and Zoë arrives in the print queue as
 * ZoÃ«. Hex with a BOM is the only encoding both ends agree on — and it
 * makes brackets and backslashes in a title a non-issue as well.
 */
function pdfText(s: string): string {
  const utf16be = Buffer.from(`﻿${s}`, "utf16le").swap16();
  return `<${utf16be.toString("hex").toUpperCase()}>`;
}

/**
 * The pdfmarks that set the document's identity and attach the output intent.
 *
 * Deliberately does NOT set GTS_PDFXVersion. That marker is what flips
 * Ghostscript into X mode and makes RGB impossible, and claiming a
 * conformance level the file does not meet would be worse than claiming
 * none — a printer that trusts the marker and finds RGB inside has been
 * misled by us.
 */
function intentPrologue(title: string): string {
  return `%!
[ /Title ${pdfText(title)} /DOCINFO pdfmark
[ /Creator (${BRAND}) /DOCINFO pdfmark
[ /Trapped /False /DOCINFO pdfmark

/ICCProfile (profile.icc) def

[ /_objdef {icc} /type /stream /OBJ pdfmark
[ {icc} <</N 3>> /PUT pdfmark
[ {icc} ICCProfile (r) file /PUT pdfmark

[ /_objdef {oi} /type /dict /OBJ pdfmark
[ {oi} <<
  /Type /OutputIntent
  /S /GTS_PDFA1
  /OutputCondition (sRGB IEC61966-2.1)
  /OutputConditionIdentifier (sRGB IEC61966-2.1)
  /RegistryName (http://www.color.org)
  /Info (sRGB IEC61966-2.1)
  /DestOutputProfile {icc}
>> /PUT pdfmark
[ {Catalog} <</OutputIntents [ {oi} ]>> /PUT pdfmark
`;
}

/**
 * Prepare a rendered PDF for a press, and verify what came out.
 *
 * Throws rather than silently returning the input: a file submitted as
 * press-ready that quietly skipped this step is exactly the failure the
 * whole preflight discipline exists to prevent.
 */
export async function toPressReady(pdf: Buffer, title: string): Promise<PressReadyResult> {
  const dir = await mkdtemp(join(tmpdir(), "pressready-"));
  try {
    const input = join(dir, "in.pdf");
    const output = join(dir, "out.pdf");
    const prologue = join(dir, "intent.ps");

    await writeFile(input, pdf);
    await writeFile(prologue, intentPrologue(title));
    // Copied in rather than read from /usr, so -dSAFER stays meaningful:
    // this runs over a customer's book and should not be able to read the
    // filesystem at large.
    await copyFile(ICC_PROFILE, join(dir, "profile.icc"));

    await run("gs", [
      "-dBATCH", "-dNOPAUSE", "-q", "-dSAFER",
      "--permit-file-read=profile.icc",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.6",
      "-dPDFSETTINGS=/prepress",
      "-dEmbedAllFonts=true",
      "-dSubsetFonts=true",
      "-dDownsampleColorImages=false",
      "-dDownsampleGrayImages=false",
      "-dDownsampleMonoImages=false",
      "-dAutoRotatePages=/None",
      "-sOutputFile=out.pdf",
      // Order matters, and not in the way it looks. A prologue placed first
      // is overwritten by the input's own DocInfo: Chromium stamps
      // /Title (about:blank) and /Creator (Mozilla/5.0 …), and those won.
      // The pdfmarks have to run after the pages for ours to be the ones
      // that survive. The output intent works either way, which is what made
      // this quiet — the file passed every check while still carrying
      // "about:blank" into a printer's queue.
      "in.pdf",
      "intent.ps",
    ], { cwd: dir, maxBuffer: 128 * 1024 * 1024 });

    const bytes = await readFile(output);
    const before = inspect(pdf);
    const found = inspect(bytes);

    if (!found.hasOutputIntent) throw new Error("no output intent was written");
    if (found.embeddedFonts === 0) throw new Error("no embedded fonts survived");
    if (found.version < "1.6") throw new Error(`produced PDF ${found.version}, expected 1.6`);
    // A pass that loses or duplicates a page is worse than no pass at all,
    // because everything downstream — page count, spine width, the folio
    // numbers already printed on the pages — was decided before this ran.
    if (found.pageCount !== before.pageCount) {
      throw new Error(`page count changed: ${before.pageCount} in, ${found.pageCount} out`);
    }
    // Checked because it silently failed once. The title is the only part of
    // this a human ever reads, and the wrong answer is not a blank — it is
    // Chromium's "about:blank" sitting next to a child's name in a queue.
    if (found.title !== title) {
      throw new Error(`title was not written: wanted "${title}", found "${found.title ?? ""}"`);
    }

    return { bytes, ...found };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Read the markers back out of a produced file.
 *
 * Measuring the artefact rather than trusting the tool — the same discipline
 * preflight uses when it reads the MediaBox instead of the size requested.
 */
export function inspect(pdf: Buffer): Omit<PressReadyResult, "bytes"> {
  const all = pdf.toString("latin1");
  return {
    version: all.slice(0, 32).match(/^%PDF-(\d\.\d)/)?.[1] ?? "unknown",
    hasOutputIntent: /\/OutputIntents/.test(all),
    embeddedFonts: (all.match(/\/FontFile\d?/g) ?? []).length,
    pageCount: (all.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    title: readTitle(all),
  };
}

/**
 * The document title, whichever of the two ways it was written.
 *
 * Ghostscript writes a plain string when the title is ASCII and a UTF-16BE
 * hex string the moment it is not — and children called Zoë and Léon exist,
 * so both branches are load-bearing rather than defensive.
 */
function readTitle(all: string): string | null {
  const m = all.match(/\/Title\s*(\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]*)>)/);
  if (!m) return null;

  // Literal form. Octal escapes are how a producer smuggles bytes above 127
  // into one — and pdfwrite re-encodes our hex string as exactly that, BOM,
  // nulls and all, so this branch reads back what the hex branch wrote.
  const bytes =
    m[2] !== undefined
      ? Buffer.from(
          m[2].replace(/\\([0-7]{1,3})|\\(.)/g, (_, oct, ch) =>
            oct ? String.fromCharCode(parseInt(oct, 8)) : ch
          ),
          "latin1"
        )
      : Buffer.from((m[3] ?? "").replace(/\s+/g, ""), "hex");

  // A BOM means UTF-16BE, whichever form carried it.
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2).swap16().toString("utf16le");
  return bytes.toString("utf8");
}

/** Whether the toolchain is present, so a caller can fail loudly not silently. */
export async function ghostscriptAvailable(): Promise<boolean> {
  try {
    await run("gs", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
