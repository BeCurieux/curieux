// Second factors.
//
// The interesting decisions here are all about what happens in the cases
// nobody designs for: an account with no factor, an abandoned enrolment, an
// assurance level the auth server has not told us about yet. Each of those
// has a safe answer and an unsafe one, and the unsafe one is usually the
// convenient one.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  asAssuranceLevel,
  defaultFactorName,
  enrolledFactors,
  hasSecondFactor,
  isLastFactor,
  kindFromFactorType,
  PROTECTED_ACTIONS,
  requiresStepUp,
  rpIdFrom,
  SUPABASE_FACTOR_TYPE,
  stepUpReason,
} from "@/lib/auth/mfa";

const root = join(__dirname, "..");

describe("assurance levels", () => {
  it("treats an unrecognised level as having proved nothing", () => {
    // The auth client types this as a loose string. Erring towards "aal2"
    // for an unknown value would let a future API change silently satisfy a
    // check that guards deleting a decade of photographs.
    expect(asAssuranceLevel("aal3")).toBeNull();
    expect(asAssuranceLevel("")).toBeNull();
    expect(asAssuranceLevel(undefined)).toBeNull();
    expect(asAssuranceLevel("aal1")).toBe("aal1");
    expect(asAssuranceLevel("aal2")).toBe("aal2");
  });

  it("asks again when a factor exists and this session hasn't used it", () => {
    expect(requiresStepUp({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });

  it("does not ask twice once it has been used", () => {
    expect(requiresStepUp({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });

  it("does not ask an account that has no factor to produce one", () => {
    // A prompt with nothing behind it teaches people to click through
    // prompts, which is the behaviour this whole feature depends on not
    // having. The answer for these accounts is to offer enrolment.
    expect(requiresStepUp({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(hasSecondFactor({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });

  it("asks when the level could not be established at all", () => {
    // currentLevel null with nextLevel aal2 means we know a factor exists
    // but could not read what this session proved. That is not a pass.
    expect(requiresStepUp({ currentLevel: null, nextLevel: "aal2" })).toBe(true);
  });
});

describe("the factor list", () => {
  const rows = [
    { id: "a", factor_type: "totp", status: "verified", created_at: "2026-02-01" },
    { id: "b", factor_type: "webauthn", status: "verified", created_at: "2026-01-01", friendly_name: "Phone" },
    { id: "c", factor_type: "webauthn", status: "unverified", created_at: "2026-03-01" },
  ];

  it("drops an enrolment that was started and abandoned", () => {
    // Listing it would tell a parent they are protected when they are not.
    const out = enrolledFactors(rows);
    expect(out.map((f) => f.id)).toEqual(["b", "a"]);
  });

  it("speaks in the product's words, not Supabase's", () => {
    expect(kindFromFactorType("webauthn")).toBe("passkey");
    expect(kindFromFactorType("totp")).toBe("authenticator");
    expect(enrolledFactors(rows).map((f) => f.kind)).toEqual(["passkey", "authenticator"]);
  });

  it("ignores a factor type we do not offer rather than mislabelling it", () => {
    // SMS. If it ever appears on an account it must not be shown as though
    // it were one of the two things this product actually recommends.
    expect(kindFromFactorType("phone")).toBeNull();
    expect(enrolledFactors([{ id: "s", factor_type: "phone", status: "verified" }])).toEqual([]);
  });

  it("knows when removing one would leave the account with none", () => {
    const one = enrolledFactors([rows[1]]);
    expect(isLastFactor(one, "b")).toBe(true);
    expect(isLastFactor(enrolledFactors(rows), "b")).toBe(false);
  });

  it("names a second factor of the same kind without saying 'Factor 2'", () => {
    const existing = enrolledFactors([rows[1]]);
    expect(defaultFactorName("passkey", [])).toBe("Passkey");
    expect(defaultFactorName("passkey", existing)).toBe("Passkey 2");
    expect(defaultFactorName("authenticator", existing)).toBe("Authenticator app");
  });
});

describe("the relying party id", () => {
  it("is the bare domain — a passkey is bound to that and nothing else", () => {
    expect(rpIdFrom("https://qotidia.com")).toBe("qotidia.com");
    expect(rpIdFrom("https://qotidia.com/settings/security")).toBe("qotidia.com");
  });

  it("strips the port, which is what otherwise breaks local development", () => {
    expect(rpIdFrom("http://localhost:3000")).toBe("localhost");
  });
});

describe("what gets protected", () => {
  it("covers destroying things and copying them out, and not much else", () => {
    // A long list is a list people click through. Each of these either
    // cannot be undone or sends a copy beyond our systems.
    expect(Object.keys(PROTECTED_ACTIONS).sort()).toEqual([
      "change_access",
      "delete_everything",
      "export_archive",
      "grant_support_access",
    ]);
  });

  it("describes each one in words a parent would use", () => {
    for (const action of Object.keys(PROTECTED_ACTIONS) as (keyof typeof PROTECTED_ACTIONS)[]) {
      const reason = stepUpReason(action);
      expect(reason).not.toMatch(/[_A-Z]/);      // not the enum key
      expect(reason.length).toBeGreaterThan(10); // not a single word
    }
  });

  it("is enforced in the actions, not only described on the page", () => {
    // A static check: the copy on the security page promises these four are
    // gated, and a promise the server does not keep is worse than no promise.
    const actions = readFileSync(join(root, "src/app/actions.ts"), "utf8");
    for (const action of Object.keys(PROTECTED_ACTIONS)) {
      expect(actions, `${action} is described as protected but never gated`).toContain(
        `gateOn("${action}"`
      );
    }
  });
});

describe("SMS is not on offer", () => {
  it("has no phone factor type anywhere in the module", () => {
    // A code sent to a phone number is the factor that gets taken from
    // people. Offering it beside a passkey implies they are equivalent.
    const mfa = readFileSync(join(root, "src/lib/auth/mfa.ts"), "utf8");
    expect(Object.values(SUPABASE_FACTOR_TYPE)).toEqual(["webauthn", "totp"]);
    expect(mfa).not.toMatch(/factorType:\s*["']phone["']/);
  });
});
