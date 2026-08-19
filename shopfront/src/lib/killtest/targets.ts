/**
 * Reading the targets file.
 *
 * One storefront per line, under a `[merchants]` or `[creators]` heading. Blank
 * lines and `#` comments are ignored, and a note may follow a URL on the same
 * line — the notation `targets.example.txt` already uses.
 *
 * **A line that is not a URL is an error, and that is the whole reason this
 * moved out of the script.** It used to be a loop inside `scripts/killtest.ts`
 * that took whatever was left after stripping the comment and called it a store,
 * which is fine until something that is not a store ends up in the file. Then it
 * is not fine at all, and the way it fails is the problem: preflight is the next
 * thing to look at the list, and preflight cannot tell a storefront from a line
 * of shell output. It only tests the properties it knows about.
 *
 * That is exactly how it went. `pnpm screen … >> killtest/targets.txt` is the
 * documented way to build this file, and pnpm writes a two-line banner to
 * stdout before the script it runs — so a redirect captures
 *
 *     > shopfront@0.1.0 screen C:\dev\popuup\shopfront
 *     > tsx --env-file-if-exists=.env.local scripts/screen.ts "killtest\candidates.txt"
 *
 * as targets. Neither starts with `#`, so both survived. Screening a second
 * batch appended the same two lines again, and the only thing preflight had to
 * say about any of it was:
 *
 *     × Duplicate targets: > shopfront@0.1.0 screen C:\dev\popuup\shopfront,
 *       > tsx --env-file-if-exists=.env.local scripts/screen.ts "…". Thirty
 *       merchants means thirty merchants.
 *
 * Every word of which is true, and none of which is the problem. The real
 * fault — shell output is in your targets file — is visible in that message
 * only to somebody who already knows. Deduplicating, which is what it asks for,
 * leaves one copy of each banner line in the file and the run then tries to
 * ingest them.
 *
 * So a line that cannot be a store URL stops the read and says what it found
 * and where. The `pnpm --silent` fix is named in the message, because being
 * told which command to use next is the difference between a thirty-second fix
 * and an afternoon.
 */

import { SEGMENTS, type Segment } from "./types";
import type { TargetInput } from "./ledger";

/** A `[section]` heading on its own line. */
const HEADING = /^\[(\w+)]$/;

export interface ParseTargetsOptions {
  /** Named in error messages so a failure points at a file rather than at text. */
  file?: string;
}

export function parseTargets(text: string, { file }: ParseTargetsOptions = {}): TargetInput[] {
  const targets: TargetInput[] = [];
  const where = file ? ` in ${file}` : "";
  let segment: Segment = "merchant";

  // Split on `\r?\n` rather than trimming a carriage return off the end by
  // accident. The screener had the same bug and it cost a full re-run: see
  // `parseCandidates` in ./screen.ts.
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const heading = HEADING.exec(line);
    if (heading) {
      const name = heading[1]!.toLowerCase().replace(/s$/, "");
      if (!SEGMENTS.includes(name as Segment)) {
        throw new Error(
          `Unknown section [${heading[1]}]${where}. Use ${SEGMENTS.map((s) => `[${s}s]`).join(" or ")}.`,
        );
      }
      segment = name as Segment;
      continue;
    }

    const hash = line.indexOf("#");
    const storeUrl = (hash === -1 ? line : line.slice(0, hash)).trim();
    const note = hash === -1 ? "" : line.slice(hash + 1).trim();
    if (storeUrl.length === 0) continue;

    if (!isStoreUrl(storeUrl)) {
      throw new Error(notAStore(storeUrl, index + 1, where));
    }

    targets.push({ storeUrl, segment, ...(note ? { note } : {}) });
  }

  return targets;
}

function isStoreUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * What to say about a line that is not a store.
 *
 * Names the redirect explicitly when the line looks like pnpm's banner, because
 * that is the one cause seen in the wild and the fix is a flag rather than an
 * edit. Otherwise it says what it found and stops, which is still better than
 * handing preflight a string to draw conclusions about.
 */
function notAStore(value: string, lineNumber: number, where: string): string {
  const short = value.length > 70 ? `${value.slice(0, 70)}…` : value;
  const banner = value.startsWith(">");

  return [
    `Line ${lineNumber}${where} is not a store URL: ${short}`,
    banner
      ? "That is pnpm's own banner, captured by a redirect. `pnpm screen … >> targets.txt` writes it into the file before the screener's output. Delete every line starting with `>` and use `pnpm --silent screen …` next time."
      : "One storefront URL per line, `#` for a comment, `[merchants]` or `[creators]` for a section.",
  ].join("\n  ");
}
