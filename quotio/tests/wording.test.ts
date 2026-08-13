import { describe, expect, it } from "vitest";

import { hydrateDocument, widgetSchemaSchema } from "@/lib/widget/schema";
import { mergeWording, wording, wordingDefaults } from "@/lib/widget/wording";
import { TEMPLATES, templateBySlug } from "@/lib/templates/catalogue";

/**
 * Author-editable button words.
 *
 * The feature is small; its failure modes are not. A cleared field that ships
 * an empty button, or a stored widget that stops parsing because we added a
 * field, are both worse than never having built it.
 */

describe("falling back to our words", () => {
  it("uses the author's when they wrote one", () => {
    expect(wording("Get my quote", "Send it over")).toBe("Get my quote");
  });

  it("uses ours when the field was never touched", () => {
    expect(wording(undefined, "Send it over")).toBe("Send it over");
  });

  it("uses ours when the field was cleared", () => {
    // The important one. Without this the widget ships a button with no text.
    expect(wording("", "Send it over")).toBe("Send it over");
  });

  it("treats whitespace as cleared", () => {
    // A space looks identical to empty on the button, so it has to behave the
    // same way as empty rather than rendering an invisible label.
    expect(wording("   ", "Send it over")).toBe("Send it over");
    expect(wording("\n\t", "Continue")).toBe("Continue");
  });

  it("keeps interior spacing, and only trims the ends", () => {
    expect(wording("  Get my quote  ", "Send it over")).toBe("Get my quote");
  });
});

describe("taking an override back", () => {
  it("keeps a real edit", () => {
    expect(mergeWording({}, { finish: "Get my quote" })).toEqual({ finish: "Get my quote" });
  });

  it("removes the override rather than storing an empty one", () => {
    expect(mergeWording({ finish: "Get my quote" }, { finish: "" })).toEqual({});
  });

  it("removes it when cleared to whitespace too", () => {
    expect(mergeWording({ next: "Next up" }, { next: "  " })).toEqual({});
  });

  it("leaves the author's other buttons alone", () => {
    expect(mergeWording({ next: "Next up", finish: "Get my quote" }, { next: "" })).toEqual({
      finish: "Get my quote",
    });
  });
});

describe("what the defaults are", () => {
  it("says the lead button leads to the result when the form comes first", () => {
    const before = wordingDefaults("before");
    expect(before.leadSubmit).toBe("See my result");
    expect(before.leadSkip).toBe("Skip this");
  });

  it("says it sends something when the form comes after", () => {
    const after = wordingDefaults("after");
    expect(after.leadSubmit).toBe("Send it over");
    expect(after.leadSkip).toBe("No thanks");
  });

  it("treats a widget with no form like one that asks afterwards", () => {
    // Nothing renders those two buttons in this case; it just must not throw
    // or hand back undefined to a placeholder.
    expect(wordingDefaults("none").leadSubmit).toBe("Send it over");
  });

  it("never returns an empty default", () => {
    for (const variant of ["before", "after", "none"] as const) {
      for (const [field, value] of Object.entries(wordingDefaults(variant))) {
        expect(value.trim(), `${variant}/${field}`).not.toBe("");
      }
    }
  });
});

describe("existing widgets keep working", () => {
  it("hydrates a document stored before the field existed", () => {
    // The bug this feature actually shipped with. Documents are written
    // through the schema but read back as raw JSON, so a widget saved before
    // `wording` existed has no `wording` — and the builder read
    // `settings.wording.next` straight off it and crashed the panel.
    //
    // Rendering was never affected: toRenderable already parses. The builder
    // was the one path handing a stored document to the client untouched.
    const stored = structuredClone(templateBySlug("cleaning-estimate")!.document) as Record<
      string,
      unknown
    >;
    delete (stored.settings as Record<string, unknown>).wording;
    expect((stored.settings as Record<string, unknown>).wording).toBeUndefined();

    const hydrated = hydrateDocument(stored as never);
    expect(hydrated.settings.wording).toEqual({});
    // The rest of the document survives the round trip unchanged.
    expect(hydrated.steps.length).toBe(templateBySlug("cleaning-estimate")!.document.steps.length);
    expect(hydrated.settings.privacyNote).toBe(
      templateBySlug("cleaning-estimate")!.document.settings.privacyNote
    );
  });

  it("parses a document written before this field existed", () => {
    const old = structuredClone(templateBySlug("cleaning-estimate")!.document) as Record<
      string,
      unknown
    >;
    delete (old.settings as Record<string, unknown>).wording;

    const parsed = widgetSchemaSchema.parse(old);
    expect(parsed.settings.wording).toEqual({});
  });

  it("leaves every shipped template on our wording", () => {
    // Templates are starting points, and the defaults are the words we have
    // decided are best. A template quietly overriding one would mean the
    // default we maintain isn't the one most people actually see.
    for (const template of TEMPLATES) {
      expect(template.document.settings.wording, template.slug).toEqual({});
    }
  });

  it("stores only what the author changed", () => {
    const document = structuredClone(templateBySlug("cleaning-estimate")!.document);
    document.settings.wording = { finish: "Get my quote" };

    const parsed = widgetSchemaSchema.parse(document);
    expect(parsed.settings.wording).toEqual({ finish: "Get my quote" });
    // The three untouched buttons are absent, not filled in with our text, so
    // improving a default later reaches widgets that never overrode it.
    expect(parsed.settings.wording.next).toBeUndefined();
  });

  it("rejects a label too long to fit on a button", () => {
    const document = structuredClone(templateBySlug("cleaning-estimate")!.document) as Record<
      string,
      unknown
    >;
    (document.settings as { wording: unknown }).wording = { next: "x".repeat(61) };
    expect(() => widgetSchemaSchema.parse(document)).toThrow();
  });
});
