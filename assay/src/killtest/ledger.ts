/**
 * The kill-test ledger: parse, merge, render.
 *
 * Separated from `scripts/killtest.ts` and tested, for one reason. The founder
 * runs the script on day one, fills in replies by hand over a fortnight, and
 * re-runs it whenever a rule changes. If a re-run clobbers the reply columns,
 * the two weeks of work that the whole company is gated on are gone, and it
 * would be gone quietly — the file would still look right. So the round trip
 * is a pure function with a test around it rather than string handling in the
 * middle of a script.
 *
 * The columns the founder fills in are free text, not enums, because a real
 * reply is not an enum: "yes but after Christmas" is a real answer and the
 * ledger should hold it. Only the yes/no columns are interpreted, and only
 * loosely — see `isYes`.
 */

/** §10's gate, verbatim: 8+ of 30 wanting it live, or 3+ offering to pay. */
export const GATE = { targets: 30, wantItLive: 8, offeredToPay: 3 } as const;

/** What the founder writes down. Everything here survives a re-run. */
export type Outreach = {
  contacted: string;
  replied: string;
  wantsItLive: string;
  askedPrice: string;
  offeredToPay: string;
  notes: string;
};

/** What the scan writes. Everything here is regenerated on a re-run. */
export type ScanRow = {
  slug: string;
  why: string;
  /** Null until the page's copy has been saved. */
  score: number | null;
  marks: number | null;
  badge: boolean | null;
  /**
   * The name printed on the card this founder saw.
   *
   * Always the name as rendered, never the override that produced it, so the
   * ledger answers "what did they actually look at" without anybody
   * cross-referencing targets.txt. It matters because §10's gate is a count of
   * people: a name that puts founders off would otherwise be read as a product
   * that puts founders off, and the two have very different consequences.
   */
  wordmark: string;
};

export type LedgerRow = ScanRow & { outreach: Outreach };

export const EMPTY_OUTREACH: Outreach = {
  contacted: "",
  replied: "",
  wantsItLive: "",
  askedPrice: "",
  offeredToPay: "",
  notes: "",
};

export const COLUMNS = [
  "brand",
  "why",
  "score",
  "marks",
  "badge",
  "name shown",
  "contacted",
  "replied",
  "wants it live",
  "asked price",
  "offered to pay",
  "notes",
] as const;

/**
 * Generous on purpose. Somebody filling this in on a phone between DMs writes
 * "y", "Y", "yes", a tick, or "1", and none of those should quietly count as
 * a no in the number the company's next month is decided by.
 */
export function isYes(value: string): boolean {
  return /^(y|yes|yep|✓|true|1)$/i.test(value.trim());
}

const escapeCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
const unescapeCell = (value: string) => value.replace(/\\\|/g, "|").trim();

/**
 * Split a markdown row on unescaped pipes.
 *
 * A naive `split("|")` breaks the moment a founder pastes a reply containing
 * one, and the row it breaks is the row holding somebody's answer.
 */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\\" && line[i + 1] === "|") {
      current += "\\|";
      i += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.slice(1, -1).map(unescapeCell);
}

/** Which outreach field each column header holds. */
const OUTREACH_COLUMN: Record<string, keyof Outreach> = {
  contacted: "contacted",
  replied: "replied",
  "wants it live": "wantsItLive",
  "asked price": "askedPrice",
  "offered to pay": "offeredToPay",
  notes: "notes",
};

/**
 * Every outreach column already written down, keyed by slug.
 *
 * Read by **header name**, not by column offset. The offsets were fine until
 * a column was inserted, at which point every ledger written by the previous
 * version would have been read one cell to the left — replies landing in the
 * wrong fields, silently, in the file the gate is computed from. Adding "name
 * shown" is what surfaced it; parsing by header means the next column costs
 * nothing.
 */
export function parseLedger(markdown: string): Map<string, Outreach> {
  const found = new Map<string, Outreach>();
  let header: string[] | null = null;

  for (const line of markdown.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = splitRow(line.trim());
    const first = (cells[0] ?? "").trim();

    if (first === "brand") {
      header = cells.map((cell) => cell.trim().toLowerCase());
      continue;
    }
    if (!first || /^-{2,}$/.test(first) || header === null) continue;

    const outreach = { ...EMPTY_OUTREACH };
    for (const [index, name] of header.entries()) {
      const field = OUTREACH_COLUMN[name];
      if (!field) continue;
      // Notes is last, and it soaks up any trailing cells. A founder typing a
      // reply into the file by hand will eventually type an unescaped pipe,
      // and losing the tail of what somebody said is worse than a scruffy cell.
      outreach[field] =
        index === header.length - 1 ? cells.slice(index).join(" ").trim() : (cells[index] ?? "");
    }
    found.set(first, outreach);
  }
  return found;
}

/** Fresh scan columns, plus whatever the founder had already written down. */
export function mergeRows(scans: ScanRow[], known: Map<string, Outreach>): LedgerRow[] {
  return scans.map((scan) => ({ ...scan, outreach: known.get(scan.slug) ?? EMPTY_OUTREACH }));
}

export type Tally = {
  targets: number;
  scanned: number;
  contacted: number;
  replied: number;
  wantItLive: number;
  offeredToPay: number;
  /** True when §10 says proceed. Either condition is sufficient. */
  proceed: boolean;
  /** True when all thirty have been contacted and neither condition was met. */
  exhausted: boolean;
};

export function tally(rows: LedgerRow[]): Tally {
  const contacted = rows.filter((row) => row.outreach.contacted.trim()).length;
  const wantItLive = rows.filter((row) => isYes(row.outreach.wantsItLive)).length;
  const offeredToPay = rows.filter((row) => isYes(row.outreach.offeredToPay)).length;
  const proceed = wantItLive >= GATE.wantItLive || offeredToPay >= GATE.offeredToPay;
  return {
    targets: rows.length,
    scanned: rows.filter((row) => row.score !== null).length,
    contacted,
    replied: rows.filter((row) => isYes(row.outreach.replied)).length,
    wantItLive,
    offeredToPay,
    proceed,
    exhausted: !proceed && contacted >= GATE.targets,
  };
}

function renderRow(row: LedgerRow): string {
  const cells = [
    row.slug,
    row.why,
    row.score === null ? "—" : String(row.score),
    row.marks === null ? "—" : String(row.marks),
    row.badge === null ? "—" : row.badge ? "yes" : "no",
    row.wordmark,
    row.outreach.contacted,
    row.outreach.replied,
    row.outreach.wantsItLive,
    row.outreach.askedPrice,
    row.outreach.offeredToPay,
    row.outreach.notes,
  ];
  return `| ${cells.map(escapeCell).join(" | ")} |`;
}

export function renderLedger(rows: LedgerRow[], counts: Tally): string {
  return [
    "# Kill-test ledger",
    "",
    "Not committed, and not to be. `.gitignore` keeps everything under",
    "`killtest/` out of the repository except the example target list — these",
    "brands have agreed to nothing, and BRIEF.md §9 is the reason.",
    "",
    "Regenerate the scan columns with `pnpm killtest`. The outreach columns are",
    "read back and preserved, so fill them in here as replies arrive. Mark the",
    "yes/no columns `y` and leave them empty otherwise; anything else is treated",
    "as a no by the count but is kept as written.",
    "",
    `| ${COLUMNS.join(" | ")} |`,
    `| ${COLUMNS.map(() => "---").join(" | ")} |`,
    ...rows.map(renderRow),
    "",
    "## The gate — BRIEF.md §10",
    "",
    `Proceed on **${GATE.wantItLive}+ of ${GATE.targets}** actively wanting the live`,
    `product, or **${GATE.offeredToPay}+** offering to pay on the spot.`,
    "",
    `- targets listed: ${counts.targets} of ${GATE.targets}`,
    `- copy saved and scanned: ${counts.scanned}`,
    `- contacted: ${counts.contacted}`,
    `- replied: ${counts.replied}`,
    `- want it live: ${counts.wantItLive} (gate ${GATE.wantItLive})`,
    `- offered to pay: ${counts.offeredToPay} (gate ${GATE.offeredToPay})`,
    "",
    counts.proceed
      ? "**§10 says proceed.**"
      : counts.exhausted
        ? "**All thirty contacted and the gate is not met.** §10: the pain is not " +
          "self-serve-acute. The sharpest surviving surface — most likely the ad " +
          "checker — becomes the whole product, or the concept folds back into " +
          "ClaimKind's funnel. Kill quickly rather than rationalise; that is what " +
          "the two-week, near-zero-cost shape of this test was for."
        : `Still running — ${GATE.targets - counts.contacted} left to contact.`,
    "",
  ].join("\n");
}
