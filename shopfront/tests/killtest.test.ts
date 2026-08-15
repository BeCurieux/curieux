/**
 * The gate.
 *
 * These tests are about one thing: making the verdict impossible to talk into
 * being what somebody wants it to be. The brief says "Kill quickly rather than
 * rationalise", and rationalising is not something a person decides to do — it
 * is what happens when a threshold was never written down precisely enough to
 * argue with.
 */

import { describe, expect, it } from "vitest";
import {
  addTargets,
  segmentOf,
  emptyLedger,
  preflight,
  recordOutcome,
  verdict,
  THRESHOLD_COUNT,
  TARGET_MERCHANTS,
  type Ledger,
  type Stage,
} from "@/lib/killtest/index";

const NOW = new Date("2026-08-11T09:00:00.000Z");

function ledgerOf(stages: Stage[], resolved = true): Ledger {
  const base = addTargets(
    emptyLedger(NOW),
    stages.map((_, i) => `https://merchant-${i}.com`),
    NOW,
  );

  return stages.reduce((ledger, stage, i) => {
    const wants = stage === "wants_it_live" || stage === "asked_price" || stage === "paid";
    return recordOutcome(
      ledger,
      `https://merchant-${i}.com`,
      { stage, ...(resolved && !wants ? { outcome: "silent" as const } : {}) },
      NOW,
    );
  }, base);
}

const full = (stage: Stage, count: number): Stage[] =>
  Array.from({ length: TARGET_MERCHANTS }, (_, i) => (i < count ? stage : ("sent" as Stage)));

describe("the verdict", () => {
  it("proceeds the moment the bar is cleared, without waiting for the rest", () => {
    // The bar is absolute. Once five merchants want it live, the other
    // twenty-five cannot change the answer.
    const v = verdict(ledgerOf(full("wants_it_live", THRESHOLD_COUNT)));
    expect(v.call).toBe("proceed");
    expect(v.wantItLive).toBe(5);
  });

  it("counts everyone at or past the threshold, not everyone sitting on it", () => {
    // A merchant who paid necessarily wanted it live. Counting only the exact
    // stage would undercount the numerator and kill a product that worked.
    const v = verdict(ledgerOf(["wants_it_live", "asked_price", "paid", "paid", "asked_price"]));
    expect(v.wantItLive).toBe(5);
    // Four, not two: someone who paid asked the price on the way. The ladder
    // counts at-or-past at every rung, or the strongest signals fall out of the
    // weaker counts that contain them.
    expect(v.askedPrice).toBe(4);
    expect(v.paid).toBe(2);
    expect(v.call).toBe("proceed");
  });

  it("refuses to call a kill before thirty merchants have been asked", () => {
    // The most likely wrong answer this tool could give: six DMs, no replies,
    // and a founder who has already decided.
    const v = verdict(ledgerOf(["sent", "sent", "opened", "replied", "sent", "sent"]));
    expect(v.call).toBe("running");
    expect(v.reason).toContain("not finished");
  });

  it("refuses to call a kill while conversations are still open", () => {
    const stages = full("replied", 30);
    const ledger = ledgerOf(stages, false);
    const v = verdict(ledger);
    expect(v.call).toBe("running");
    expect(v.outstanding).toBeGreaterThan(0);
  });

  it("calls the kill once every conversation has resolved and the bar was missed", () => {
    const v = verdict(ledgerOf([...full("wants_it_live", 4)]));
    expect(v.call).toBe("kill");
    expect(v.wantItLive).toBe(4);
    expect(v.reason).toContain("rationalise");
  });

  it("treats wanting it live as resolution, not as an open conversation", () => {
    // Somebody who asked to connect has answered the question the test asks.
    // Leaving them "open" would hold a proceed hostage to follow-up admin.
    const v = verdict(ledgerOf(full("wants_it_live", 6)));
    expect(v.call).toBe("proceed");
  });
});

describe("the ledger", () => {
  it("never lets a stage go backwards", () => {
    // A merchant who asked to connect and then went quiet still asked to
    // connect. Overwriting that a week later would quietly edit the numerator.
    let ledger = addTargets(emptyLedger(NOW), ["https://a.com"], NOW);
    ledger = recordOutcome(ledger, "https://a.com", { stage: "wants_it_live" }, NOW);
    ledger = recordOutcome(ledger, "https://a.com", { stage: "opened", outcome: "silent" }, NOW);

    const target = ledger.targets[0]!;
    expect(target.stage).toBe("wants_it_live");
    expect(target.outcome).toBe("silent");
    expect(verdict(ledger).wantItLive).toBe(1);
  });

  it("does not add the same merchant twice", () => {
    let ledger = addTargets(emptyLedger(NOW), ["https://a.com", "https://b.com"], NOW);
    ledger = addTargets(ledger, ["https://b.com", "https://c.com"], NOW);
    expect(ledger.targets).toHaveLength(3);
  });

  it("separates a merchant we could not generate for from one who said no", () => {
    // A failed ingest is not a rejection, and letting it look like one poisons
    // the denominator in the direction of a false kill.
    let ledger = addTargets(emptyLedger(NOW), ["https://a.com", "https://b.com"], NOW);
    ledger = recordOutcome(ledger, "https://a.com", { slug: "a", shopUrl: "https://popuup.com/a" }, NOW);

    const v = verdict(ledger);
    expect(v.generated).toBe(1);
    expect(v.contacted).toBe(2);
  });
});

describe("preflight", () => {
  const real = ["https://kelpandcotton.com", "https://saltandstone.com"];

  it("refuses to run the test on the deterministic providers", () => {
    // The single most damaging way to run this. Thirty merchants shown a
    // competent-but-flat shop say no, and the conclusion recorded is "merchants
    // do not want this" rather than "we showed them the wrong thing".
    const result = preflight({ storeUrls: real, aiProvider: "mock", anthropicKey: "sk-x" });
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("do not merchandise");
  });

  it("refuses without a key", () => {
    expect(preflight({ storeUrls: real, aiProvider: "anthropic" }).ok).toBe(false);
  });

  it("warns, but does not refuse, when the ingester's last rung has no browser", () => {
    // Not a blocker: a list of stores with open feeds never reaches that rung,
    // and refusing over a dependency most of the list does not have would be
    // wrong. But CHROMIUM_PATH unset is a *silent* skip — the trace reads "no
    // browser available" and the catalogue comes back thin — so the preflight
    // of a thirty-merchant run is the one place it has to be said out loud.
    const result = preflight({ storeUrls: real, aiProvider: "anthropic", anthropicKey: "sk-x" });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain("CHROMIUM_PATH");
  });

  it("says nothing about the browser once CHROMIUM_PATH is set", () => {
    const result = preflight({
      storeUrls: real,
      aiProvider: "anthropic",
      anthropicKey: "sk-x",
      chromiumPath: "/opt/chromium/chrome",
    });
    expect(result.warnings.join(" ")).not.toContain("CHROMIUM_PATH");
  });

  it("refuses a local address, because the test needs real storefronts", () => {
    const result = preflight({
      storeUrls: [...real, "http://127.0.0.1:8940"],
      aiProvider: "anthropic",
      anthropicKey: "sk-x",
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("local address");
  });

  it("refuses duplicates, because thirty merchants means thirty merchants", () => {
    const result = preflight({
      storeUrls: [...real, "https://kelpandcotton.com"],
      aiProvider: "anthropic",
      anthropicKey: "sk-x",
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toContain("Duplicate");
  });

  it("warns about a short list rather than blocking it", () => {
    // A run can legitimately be built up in batches, and the verdict already
    // refuses to call a kill on one.
    const result = preflight({ storeUrls: real, aiProvider: "anthropic", anthropicKey: "sk-x" });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain("cannot produce a kill verdict");
  });

  it("passes a real run, silently", () => {
    // Silence is the assertion. Every warning this file can produce is one
    // somebody has to read and dismiss, so a fully-configured run printing
    // nothing is what keeps the ones it does print worth reading.
    const thirty = Array.from({ length: 30 }, (_, i) => `https://merchant-${i}.com`);
    const result = preflight({
      storeUrls: thirty,
      aiProvider: "anthropic",
      anthropicKey: "sk-x",
      chromiumPath: "/opt/chromium/chrome",
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

/**
 * Creators on the list.
 *
 * The rule being held: adding a second segment must add information and must
 * not be able to move the bar. A test that only checked the tally would pass
 * while the gate quietly became clearable by inviting more creators.
 */
describe("segments", () => {
  const creator = (storeUrl: string) => ({ storeUrl, segment: "creator" as const });

  it("treats a bare URL as a merchant, which is what every list was before", () => {
    const ledger = addTargets(emptyLedger(NOW), ["https://a.com"], NOW);
    expect(segmentOf(ledger.targets[0]!)).toBe("merchant");
  });

  it("reads a target written before segments existed as a merchant", () => {
    // A run in progress must not be re-segmented by a schema change.
    const legacy: Ledger = {
      version: 1,
      startedAt: NOW.toISOString(),
      targets: [{ storeUrl: "https://a.com", stage: "wants_it_live", outcome: "open", updatedAt: NOW.toISOString() }],
    };
    expect(verdict(legacy).wantItLive).toBe(1);
    expect(verdict(legacy).segments.merchant.contacted).toBe(1);
  });

  it("keeps a note from the targets file", () => {
    const ledger = addTargets(emptyLedger(NOW), [{ storeUrl: "https://a.com", note: "beauty, ~80 products" }], NOW);
    expect(ledger.targets[0]!.note).toBe("beauty, ~80 products");
  });

  it("counts creators separately and leaves them out of the bar", () => {
    let ledger = addTargets(emptyLedger(NOW), [creator("https://c1.com"), creator("https://c2.com")], NOW);
    ledger = recordOutcome(ledger, "https://c1.com", { stage: "wants_it_live" }, NOW);
    ledger = recordOutcome(ledger, "https://c2.com", { stage: "paid" }, NOW);

    const v = verdict(ledger);
    expect(v.segments.creator).toEqual({ contacted: 2, wantItLive: 2 });
    // Nothing about the merchant gate moved.
    expect(v.wantItLive).toBe(0);
    expect(v.contacted).toBe(0);
  });

  it("cannot be made to proceed by adding creators", () => {
    // The failure this exists to prevent: four merchants short of the bar, and
    // a pile of enthusiastic creators making the number look fine.
    let ledger = addTargets(emptyLedger(NOW), Array.from({ length: 30 }, (_, i) => `https://m${i}.com`), NOW);
    for (let i = 0; i < 4; i++) ledger = recordOutcome(ledger, `https://m${i}.com`, { stage: "wants_it_live" }, NOW);
    for (let i = 4; i < 30; i++) ledger = recordOutcome(ledger, `https://m${i}.com`, { outcome: "declined" }, NOW);

    ledger = addTargets(ledger, Array.from({ length: 20 }, (_, i) => creator(`https://c${i}.com`)), NOW);
    for (let i = 0; i < 20; i++) ledger = recordOutcome(ledger, `https://c${i}.com`, { stage: "wants_it_live" }, NOW);

    const v = verdict(ledger);
    expect(v.segments.creator.wantItLive).toBe(20);
    expect(v.call).toBe("kill");
  });

  it("does not let creators pad the contacted count toward thirty", () => {
    // The other direction: a test that is not finished must not look finished.
    let ledger = addTargets(emptyLedger(NOW), Array.from({ length: 10 }, (_, i) => `https://m${i}.com`), NOW);
    ledger = addTargets(ledger, Array.from({ length: 25 }, (_, i) => creator(`https://c${i}.com`)), NOW);

    const v = verdict(ledger);
    expect(v.contacted).toBe(10);
    expect(v.call).toBe("running");
    expect(v.reason).toContain(`10 of ${TARGET_MERCHANTS}`);
  });
});
