/**
 * Which variable the API key arrives in.
 *
 * This exists because of a specific, silent failure. `ANTHROPIC_API_KEY` is the
 * obvious name and it is also the name a coding agent uses for its own
 * credential, so inside one the value is stripped and never reaches the
 * process. The dashboard shows the key set, `AI_PROVIDER=anthropic` arrives
 * fine, and generation fails claiming the key is missing — which looks like a
 * bug in the key rather than in the name.
 *
 * The rule these hold is small: two names, a stated order, and blank treated as
 * absent. Every one of those is a way to pick the wrong branch quietly.
 */

import { describe, expect, it } from "vitest";
import { anthropicApiKey, hasAnthropicKey, KEY_VARS, MISSING_KEY } from "@/lib/anthropic-key";

describe("anthropicApiKey", () => {
  it("reads the ordinary name, which is what a laptop will have", () => {
    expect(anthropicApiKey({ ANTHROPIC_API_KEY: "sk-ant-laptop" })).toBe("sk-ant-laptop");
  });

  it("reads the specific name, which is the only one that works inside an agent", () => {
    expect(anthropicApiKey({ POPUUP_ANTHROPIC_API_KEY: "sk-ant-agent" })).toBe("sk-ant-agent");
  });

  it("prefers the specific name when both are set", () => {
    // Both present is the interesting case, and it is not hypothetical: an
    // agent sets the shared name for itself. Deferring to it would mean
    // generating shops on somebody else's credential.
    expect(
      anthropicApiKey({ POPUUP_ANTHROPIC_API_KEY: "sk-ant-ours", ANTHROPIC_API_KEY: "sk-ant-theirs" }),
    ).toBe("sk-ant-ours");
  });

  it("does not read an empty or blank variable as an answer", () => {
    // A variable set to "" in a dashboard is present and means nothing. Left
    // unhandled it shadows the name that does carry a key.
    expect(anthropicApiKey({ POPUUP_ANTHROPIC_API_KEY: "", ANTHROPIC_API_KEY: "sk-ant-real" })).toBe("sk-ant-real");
    expect(anthropicApiKey({ POPUUP_ANTHROPIC_API_KEY: "   ", ANTHROPIC_API_KEY: "sk-ant-real" })).toBe("sk-ant-real");
    expect(anthropicApiKey({})).toBeUndefined();
    expect(hasAnthropicKey({})).toBe(false);
  });

  it("trims, because a dashboard field collects trailing whitespace", () => {
    expect(anthropicApiKey({ ANTHROPIC_API_KEY: "  sk-ant-padded \n" })).toBe("sk-ant-padded");
  });
});

describe("the message when it is missing", () => {
  it("names both variables", () => {
    // The reader is in one of two situations and the message cannot tell
    // which. Naming only the obvious one leaves somebody inside an agent
    // setting it repeatedly and watching it not work.
    for (const name of KEY_VARS) expect(MISSING_KEY).toContain(name);
  });

  it("says what to do instead", () => {
    expect(MISSING_KEY).toMatch(/AI_PROVIDER=mock/);
  });
});
