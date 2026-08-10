// Asking for the microphone once, properly.
//
// The old failure was a single sentence for every way this can go wrong:
// "We couldn't reach your microphone. Check the browser's permission and try
// again." For a parent whose browser has blocked the site that is a dead end
// dressed as a next step — retrying a blocked permission does not re-prompt,
// it fails instantly and identically, and the third time it happens they
// conclude the feature is broken rather than that they are two taps from
// fixing it.
//
// That matters more here than in most products. Everything else in this
// archive can be recreated later at a worse resolution; a three-year-old's
// voice cannot be recorded next year at all.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { codeOnly as bare } from "./helpers/source";
import { BEFORE_ASKING, SAYS, canRecord, currentState, readError } from "@/lib/media/microphone";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const recorder = src("../src/app/subjects/[subjectId]/upload/recorder.tsx");

const boom = (name: string) => Object.assign(new Error(name), { name });

describe("reading what went wrong", () => {
  it("tells the five failures apart", () => {
    expect(readError(boom("NotAllowedError"))).toBe("blocked");
    expect(readError(boom("NotFoundError"))).toBe("absent");
    expect(readError(boom("NotReadableError"))).toBe("busy");
    expect(readError(boom("SecurityError"))).toBe("unsupported");
    expect(readError(new TypeError("mediaDevices is undefined"))).toBe("unsupported");
  });

  it("knows the older spellings browsers still throw", () => {
    expect(readError(boom("PermissionDeniedError"))).toBe("blocked");
    expect(readError(boom("DevicesNotFoundError"))).toBe("absent");
    expect(readError(boom("TrackStartError"))).toBe("busy");
  });

  it("treats an unrecognised refusal as blocked, not as nothing", () => {
    // Erring towards directions costs a dismissed person one sentence.
    // Erring the other way costs a blocked person the feature.
    expect(readError(boom("WhoKnowsError"))).toBe("blocked");
    expect(readError(null)).toBe("blocked");
  });
});

describe("what we tell them", () => {
  it("never tells a blocked person to try again", () => {
    // The exact sentence this work exists to delete.
    expect(SAYS.blocked.retryable).toBe(false);
    expect(`${SAYS.blocked.what} ${SAYS.blocked.next}`).not.toMatch(/try again/i);
  });

  it("gives a blocked person somewhere to go", () => {
    expect(SAYS.blocked.next).toMatch(/padlock|settings icon/i);
    expect(SAYS.blocked.next).toMatch(/come back/i);
  });

  it("ends every case somewhere, or says plainly that it doesn't", () => {
    for (const [state, says] of Object.entries(SAYS)) {
      expect(says.what.length, state).toBeGreaterThan(20);
      expect(says.next, state).toBeTruthy();
      // A retryable state must not read like a dead end, and vice versa.
      if (!says.retryable) expect(says.next, state).not.toMatch(/\btry again\b/i);
    }
  });

  it("names no browser menus that will be wrong for half the readers", () => {
    const all = Object.values(SAYS).map((s) => `${s.what} ${s.next}`).join(" ");
    expect(all).not.toMatch(/chrome|safari|firefox|edge|three dots|hamburger/i);
  });

  it("blames nobody", () => {
    // Somebody who has just refused a microphone prompt does not need to be
    // told they did something wrong.
    const all = Object.values(SAYS).map((s) => `${s.what} ${s.next}`).join(" ");
    expect(all).not.toMatch(/you (must|need to|should have|failed)|denied access|you refused/i);
  });
});

describe("what is said before the browser asks", () => {
  it("says what it is for, what leaves the device, and what saying no costs", () => {
    // The browser's dialog has room for a hostname. Everything needed in
    // order to say yes has to be on the page above it.
    expect(BEFORE_ASKING).toMatch(/nothing is sent anywhere while/i);
    expect(BEFORE_ASKING).toMatch(/until you listen back and decide/i);
    expect(BEFORE_ASKING).toMatch(/nothing else here changes/i);
  });

  it("is true — nothing is uploaded until they keep it", () => {
    // The claim above is the one that earns the yes, so it has to be a fact
    // about the code. Recording accumulates chunks in memory; the only
    // upload lives in save(), behind the Keep button.
    const recording = recorder.slice(
      recorder.indexOf("const start ="),
      recorder.indexOf("const save =")
    );
    expect(recording).not.toMatch(/fetch\(|uploadTicket|registerVoiceMemory/);
    expect(recorder.slice(recorder.indexOf("const save ="))).toMatch(/uploadTicket/);
  });

  it("is shown before the prompt, not after it", () => {
    expect(recorder).toContain("BEFORE_ASKING");
    expect(recorder.indexOf("BEFORE_ASKING")).toBeLessThan(recorder.indexOf("Start recording"));
  });
});

describe("when we ask", () => {
  it("never on mount", () => {
    // A prompt nobody asked for is the strongest predictor of a permanent
    // block, and a permanent block takes the feature away for good.
    const effect = bare(recorder).slice(
      bare(recorder).indexOf("useEffect("),
      bare(recorder).indexOf("const stopTimer")
    );
    expect(effect).not.toContain("getUserMedia");
    expect(effect).toContain("currentState()");
  });

  it("reads the standing decision without prompting for it", async () => {
    // permissions.query() asks the person nothing.
    const nav = {
      mediaDevices: { getUserMedia: () => {} },
      permissions: { query: async () => ({ state: "denied" }) },
    };
    expect(await currentState(nav)).toBe("blocked");
  });

  it("says unasked rather than guessing where the browser won't say", async () => {
    // Safari does not implement permissions.query for the microphone. An
    // unknown state must never render as a refusal.
    expect(await currentState({ mediaDevices: { getUserMedia: () => {} } })).toBe("unasked");
    expect(
      await currentState({
        mediaDevices: { getUserMedia: () => {} },
        permissions: { query: async () => { throw new TypeError("bad name"); } },
      })
    ).toBe("unasked");
  });

  it("knows an old browser or an insecure origin before offering anything", async () => {
    expect(canRecord({})).toBe(false);
    expect(canRecord(undefined)).toBe(false);
    expect(await currentState({})).toBe("unsupported");
  });

  it("only ever calls getUserMedia from a tap", () => {
    const calls = (bare(recorder).match(/getUserMedia/g) ?? []).length;
    expect(calls).toBe(1);
    const start = bare(recorder).slice(bare(recorder).indexOf("const start ="));
    expect(start.slice(0, start.indexOf("getUserMedia"))).toContain("asksRef.current += 1");
  });
});

describe("refusing costs nothing else", () => {
  it("says so on the page, not only in the pre-prompt", () => {
    expect(recorder).toMatch(/Everything else on this page still works/);
    expect(recorder).toMatch(/only the sound of it is missing/);
  });

  it("hides the button only where pressing it could not work", () => {
    expect(recorder).toMatch(/!said \|\| said\.retryable/);
    expect(SAYS.dismissed.retryable).toBe(true);
    expect(SAYS.busy.retryable).toBe(true);
    expect(SAYS.unsupported.retryable).toBe(false);
  });
});
