/**
 * The ledger round trip.
 *
 * The failure this guards against is quiet and expensive: the founder fills in
 * two weeks of replies by hand, re-runs `pnpm killtest` because a rule
 * changed, and the reply columns come back empty. The file still looks right.
 * The numbers the company's next month is decided on are gone.
 */

import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  EMPTY_OUTREACH,
  GATE,
  isYes,
  mergeRows,
  parseLedger,
  renderLedger,
  tally,
  type LedgerRow,
  type ScanRow,
} from "@/killtest/ledger.js";

const scanRow = (slug: string, score: number | null = 72): ScanRow => ({
  slug,
  why: `because of ${slug}`,
  score,
  marks: score === null ? null : 4,
  badge: score === null ? null : false,
  wordmark: "Franca",
});

const withReplies = (slug: string, replies: Partial<LedgerRow["outreach"]>): LedgerRow => ({
  ...scanRow(slug),
  outreach: { ...EMPTY_OUTREACH, ...replies },
});

const roundTrip = (rows: LedgerRow[]) => parseLedger(renderLedger(rows, tally(rows)));

describe("the ledger records the name that was on the card", () => {
  it("writes the name shown next to the scan", () => {
    const rows = [{ ...scanRow("aurelia"), outreach: EMPTY_OUTREACH }];
    expect(renderLedger(rows, tally(rows))).toContain("| Franca |");
  });

  it("keeps a per-target override, so a name test is legible afterwards", () => {
    const rows: LedgerRow[] = [
      { ...scanRow("aurelia"), wordmark: "SORREL", outreach: { ...EMPTY_OUTREACH, wantsItLive: "y" } },
    ];
    const rendered = renderLedger(rows, tally(rows));
    expect(rendered).toContain("SORREL");
    // The reply still round-trips with the extra column in place — the whole
    // reason the parser reads by header rather than by offset.
    expect(parseLedger(rendered).get("aurelia")?.wantsItLive).toBe("y");
  });

  it("reads replies by column name, so an inserted column cannot shift them", () => {
    // A ledger written by a future version with one more scan column. Under
    // the old positional parser every reply here would come back one cell to
    // the left, quietly, in the file the gate is computed from.
    const future = [
      "| brand | why | score | marks | badge | name shown | pack | contacted | replied | wants it live | asked price | offered to pay | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| aurelia | EU launch | 24 | 17 | no | Franca | 2026.08.2 | 19 Aug DM | y | y |  |  | wants it for their EU launch |",
    ].join("\n");
    const parsed = parseLedger(future).get("aurelia");
    expect(parsed?.contacted).toBe("19 Aug DM");
    expect(parsed?.wantsItLive).toBe("y");
    expect(parsed?.notes).toBe("wants it for their EU launch");
  });
});

describe("a re-run does not eat a fortnight of replies", () => {
  it("returns every outreach column exactly as it went in", () => {
    const row = withReplies("nocturne", {
      contacted: "2026-08-18 DM",
      replied: "y",
      wantsItLive: "y",
      askedPrice: "y",
      offeredToPay: "y",
      notes: "asked whether it does TikTok too",
    });
    expect(roundTrip([row]).get("nocturne")).toEqual(row.outreach);
  });

  it("carries replies onto a freshly rescanned row", () => {
    const known = roundTrip([withReplies("lumen", { contacted: "2026-08-18 email", replied: "y" })]);
    const merged = mergeRows([scanRow("lumen", 41)], known);
    expect(merged[0]!.score).toBe(41);
    expect(merged[0]!.outreach.contacted).toBe("2026-08-18 email");
    expect(merged[0]!.outreach.replied).toBe("y");
  });

  it("leaves a target nobody has written to yet empty rather than inventing a no", () => {
    expect(mergeRows([scanRow("vesper")], new Map())[0]!.outreach).toEqual(EMPTY_OUTREACH);
  });

  it("survives a reply containing a pipe, which is how a naive parser dies", () => {
    const row = withReplies("halden", { notes: 'they said "maybe | later" and left it there' });
    expect(roundTrip([row]).get("halden")?.notes).toBe('they said "maybe | later" and left it there');
  });

  it("survives a target with no copy saved yet", () => {
    const row = { ...scanRow("unsaved", null), outreach: { ...EMPTY_OUTREACH, contacted: "2026-08-19 DM" } };
    expect(roundTrip([row]).get("unsaved")?.contacted).toBe("2026-08-19 DM");
  });

  it("ignores the header and separator rows it wrote itself", () => {
    const parsed = roundTrip([withReplies("nocturne", { replied: "y" })]);
    expect([...parsed.keys()]).toEqual(["nocturne"]);
  });

  it("has a header for every field it reads back", () => {
    // The order no longer matters — parseLedger reads by header name. What
    // does matter is that the two lists cannot drift apart: a renamed column
    // that nothing reads back is a reply silently dropped on the next re-run.
    const rows = [withReplies("nocturne", { contacted: "a", replied: "b", wantsItLive: "c", askedPrice: "d", offeredToPay: "e", notes: "f" })];
    expect(roundTrip(rows).get("nocturne")).toEqual({
      contacted: "a",
      replied: "b",
      wantsItLive: "c",
      askedPrice: "d",
      offeredToPay: "e",
      notes: "f",
    });
    expect(COLUMNS[0]).toBe("brand");
  });
});

describe("the gate is counted the way §10 words it", () => {
  const wanting = (n: number) =>
    Array.from({ length: n }, (_, i) => withReplies(`want-${i}`, { contacted: "x", replied: "y", wantsItLive: "y" }));
  const paying = (n: number) =>
    Array.from({ length: n }, (_, i) => withReplies(`pay-${i}`, { contacted: "x", replied: "y", offeredToPay: "y" }));

  it("proceeds on eight wanting it live", () => {
    expect(tally(wanting(GATE.wantItLive)).proceed).toBe(true);
    expect(tally(wanting(GATE.wantItLive - 1)).proceed).toBe(false);
  });

  it("proceeds on three offering to pay, however few merely wanted it", () => {
    expect(tally(paying(GATE.offeredToPay)).proceed).toBe(true);
    expect(tally(paying(GATE.offeredToPay - 1)).proceed).toBe(false);
  });

  it("is not exhausted while targets are still uncontacted", () => {
    const counts = tally(wanting(2));
    expect(counts.exhausted).toBe(false);
    expect(counts.contacted).toBe(2);
  });

  it("is exhausted once thirty are contacted and neither bar was cleared", () => {
    const rows = Array.from({ length: GATE.targets }, (_, i) => withReplies(`t-${i}`, { contacted: "x" }));
    const counts = tally(rows);
    expect(counts.exhausted).toBe(true);
    expect(renderLedger(rows, counts)).toContain("Kill quickly rather than rationalise");
  });

  it("says proceed in the file, not only in the terminal", () => {
    const rows = wanting(GATE.wantItLive);
    expect(renderLedger(rows, tally(rows))).toContain("§10 says proceed");
  });

  it("counts a yes however it was typed, and nothing else", () => {
    for (const written of ["y", "Y", "yes", "Yes", "yep", "✓", "1", " y "]) expect(isYes(written)).toBe(true);
    for (const written of ["", "n", "no", "not yet", "maybe", "y later"]) expect(isYes(written)).toBe(false);
  });

  it("keeps an ambiguous answer in the file even though it does not count it", () => {
    const row = withReplies("maybe", { wantsItLive: "yes but after Christmas" });
    expect(tally([row]).wantItLive).toBe(0);
    expect(roundTrip([row]).get("maybe")?.wantsItLive).toBe("yes but after Christmas");
  });
});

describe("the ledger says what it is", () => {
  it("reminds the reader it is not committed, next to the brand names", () => {
    const rows = [withReplies("nocturne", {})];
    expect(renderLedger(rows, tally(rows))).toContain("`.gitignore`");
  });

  it("prints the gate's arithmetic rather than only its verdict", () => {
    const rows = [withReplies("a", { contacted: "x", replied: "y", wantsItLive: "y" })];
    const text = renderLedger(rows, tally(rows));
    expect(text).toContain(`want it live: 1 (gate ${GATE.wantItLive})`);
    expect(text).toContain(`offered to pay: 0 (gate ${GATE.offeredToPay})`);
  });
});
