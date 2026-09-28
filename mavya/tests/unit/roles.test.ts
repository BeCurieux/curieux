import { describe, expect, it } from "vitest";
import { availableShells, homePath } from "@/lib/auth/roles";

describe("availableShells", () => {
  it("gives an owner the business shell", () => {
    expect(availableShells({ staffRoles: ["owner"], familyCount: 0 })).toEqual(["business"]);
  });

  it("gives an instructor the instructor shell", () => {
    expect(availableShells({ staffRoles: ["instructor"], familyCount: 0 })).toEqual(["instructor"]);
  });

  it("gives a family member the family shell", () => {
    expect(availableShells({ staffRoles: [], familyCount: 1 })).toEqual(["family"]);
  });

  it("gives nothing to someone with no role", () => {
    expect(availableShells({ staffRoles: [], familyCount: 0 })).toEqual([]);
  });

  it("orders several roles business, instructor, family", () => {
    expect(
      availableShells({ staffRoles: ["instructor", "owner", "instructor"], familyCount: 2 }),
    ).toEqual(["business", "instructor", "family"]);
  });
});

describe("homePath", () => {
  it("lands on the highest-priority shell", () => {
    expect(homePath(["instructor", "family"])).toBe("/instructor");
  });

  it("sends someone with no role to the no-access page", () => {
    expect(homePath([])).toBe("/no-access");
  });
});
