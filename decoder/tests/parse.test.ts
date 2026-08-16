/**
 * The vision adapter.
 *
 * Every test injects its own transport, so the suite never reaches a model and
 * a red run here is always about the commit.
 */

import { describe, expect, it } from "vitest";
import { ParseError, parseLabel, type VisionRequest, type VisionTransport } from "@/lib/parse";
import { SYSTEM_PROMPT } from "@/lib/parse/prompt";

const GOOD = JSON.stringify({
  category: "snack",
  productName: "Crisps",
  ingredients: [{ text: "Potatoes", legibility: "clear", readConfidence: 0.99, contains: [] }],
  containsStatement: [],
  truncated: false,
  note: null,
});

function scripted(responses: string[]): VisionTransport & { seen: VisionRequest[] } {
  const seen: VisionRequest[] = [];
  let i = 0;
  return {
    seen,
    async read(request) {
      seen.push(request);
      return responses[Math.min(i++, responses.length - 1)] ?? "";
    },
  };
}

const IMAGE = { imageBase64: "AAAA", mediaType: "image/jpeg" as const };

describe("reading a label", () => {
  it("parses a clean response", async () => {
    const { label, provenance } = await parseLabel(IMAGE, scripted([GOOD]));
    expect(label.ingredients[0]!.text).toBe("Potatoes");
    expect(provenance.attempts).toBe(1);
  });

  it("survives a fenced response with a preamble", async () => {
    const messy = "Here is the transcription:\n\n```json\n" + GOOD + "\n```\n\nAnything else?";
    const { label } = await parseLabel(IMAGE, scripted([messy]));
    expect(label.ingredients).toHaveLength(1);
  });

  it("retries with the validation error, and says how many attempts it took", async () => {
    const transport = scripted(['{"category":"nonsense"}', GOOD]);
    const { provenance } = await parseLabel(IMAGE, transport);
    expect(provenance.attempts).toBe(2);
    // The second attempt has to actually carry the error, or the retry is just
    // a second roll of the same dice.
    expect(transport.seen[1]!.user).toContain("could not be used");
  });

  it("throws rather than returning a half-parsed label", async () => {
    // §8 Step 2 — never silently guess. "We couldn't read it" is a perfectly
    // good answer; a verdict over a guess is not.
    await expect(parseLabel(IMAGE, scripted(["not json at all"]))).rejects.toBeInstanceOf(ParseError);
  });

  it("keeps every raw attempt on the error, for §15's failure corpus", async () => {
    try {
      await parseLabel(IMAGE, scripted(["nope"]), { maxAttempts: 3 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      expect((error as ParseError).attempts).toHaveLength(3);
    }
  });

  it("passes the image through unchanged", async () => {
    const transport = scripted([GOOD]);
    await parseLabel(IMAGE, transport);
    expect(transport.seen[0]!.imageBase64).toBe("AAAA");
    expect(transport.seen[0]!.mediaType).toBe("image/jpeg");
  });
});

describe("what must not be tidied away", () => {
  it("keeps an ingredient the model marked unreadable", async () => {
    // The dangerous shortcut is a model returning a short clean list because it
    // dropped what it could not read. A short clean list is the most dangerous
    // possible output, because it looks complete.
    const withGap = JSON.stringify({
      category: "bakery",
      ingredients: [
        { text: "Flour", legibility: "clear", readConfidence: 0.98 },
        { text: "???", legibility: "unreadable", readConfidence: 0.05 },
      ],
      truncated: true,
    });
    const { label } = await parseLabel(IMAGE, scripted([withGap]));
    expect(label.ingredients).toHaveLength(2);
    expect(label.ingredients[1]!.legibility).toBe("unreadable");
    expect(label.truncated).toBe(true);
  });
});

describe("the prompt", () => {
  it("tells the model it is transcribing, not judging", () => {
    // Not a control — `ParsedLabel` is the control — but a model asked to
    // transcribe transcribes better than one quietly deciding what matters.
    expect(SYSTEM_PROMPT).toMatch(/TRANSCRIBE, DO NOT INTERPRET/);
    expect(SYSTEM_PROMPT).toMatch(/NO SCORES, NO FLAGS/);
    expect(SYSTEM_PROMPT).toMatch(/NEVER DROP AN INGREDIENT/);
    expect(SYSTEM_PROMPT).toMatch(/NEVER GUESS AT TEXT/);
  });
});
