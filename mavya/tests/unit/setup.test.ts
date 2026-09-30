import { describe, expect, it } from "vitest";
import { setupSteps, type SetupProgress } from "@/lib/domain/invites";
import { safeNext } from "@/lib/auth/next";

const empty: SetupProgress = {
  locations: 0,
  levels: 0,
  makeupRules: false,
  instructors: 0,
  classes: 0,
  families: 0,
  familiesJoined: 0,
  invitesPending: 0,
};

describe("the set-up checklist", () => {
  it("starts with nothing done", () => {
    expect(setupSteps(empty).filter((s) => s.done)).toEqual([]);
  });

  it("needs classes and families both before moving in counts as done", () => {
    const step = (p: Partial<SetupProgress>) =>
      setupSteps({ ...empty, ...p }).find((s) => s.key === "move-in")!.done;
    expect(step({ classes: 3 })).toBe(false);
    expect(step({ classes: 3, families: 40 })).toBe(true);
  });

  it("says how many families have joined", () => {
    const invite = setupSteps({
      ...empty,
      families: 40,
      familiesJoined: 3,
      invitesPending: 5,
    }).find((s) => s.key === "invite")!;
    expect(invite.detail).toBe("3 of 40 families have joined, 5 invited");
    expect(invite.done).toBe(true);
  });
});

describe("where sign-in sends people", () => {
  it("only to an invite link", () => {
    const code = "a".repeat(64);
    expect(safeNext(`/join/${code}`)).toBe(`/join/${code}`);
    expect(safeNext("https://evil.test/")).toBeNull();
    expect(safeNext("//evil.test")).toBeNull();
    expect(safeNext("/business")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
