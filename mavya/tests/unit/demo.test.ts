import { describe, expect, it } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";
import { AVA_ID, DEMO_FAMILY_ID, DEMO_ORG_ID, PRIMARY_CLASS_ID } from "@/lib/demo/data";
import {
  candidatesFor,
  childSlug,
  classSlug,
  isCandidate,
  isDemoFamily,
  isDemoStaff,
  resolveChildId,
  resolveClassId,
} from "@/lib/demo/service";
import { EMPTY_STATE, parseDemoState, type DemoState } from "@/lib/demo/state-schema";
import demoJson from "../../seed/demo-data.json";
import {
  CHILDREN,
  CLASSES,
  DEMO_ABSENCES,
  FAMILIES,
  ORGS,
  enrolmentRows,
} from "../../scripts/fixtures";

const state = (patch: Partial<DemoState> = {}): DemoState => ({ ...EMPTY_STATE, ...patch });

const enrolled = (classId: string) => enrolmentRows().filter((e) => e.class_id === classId).length;

describe("demo data", () => {
  it("belongs to the seeded Aqua House and Burrows family", () => {
    expect(DEMO_ORG_ID).toBe(ORGS.aqua.id);
    expect(DEMO_FAMILY_ID).toBe(FAMILIES.burrows.id);
    expect(AVA_ID).toBe(CHILDREN.ava.id);
    expect(PRIMARY_CLASS_ID).toBe(CLASSES.dolphin3Wed.id);
  });

  it("gives the seeded classes the enrolled counts the demo shows", () => {
    for (const c of demoJson.classes) {
      const real = {
        "dolphin3-wed": CLASSES.dolphin3Wed,
        "dolphin3-thu": CLASSES.dolphin3Thu,
        "dolphin3-sat": CLASSES.dolphin3Sat,
        "dolphin3-tue": CLASSES.dolphin3Tue,
      }[c.id]!;
      expect(enrolled(real.id), c.id).toBe(c.enrolled);
    }
  });

  it("seeds one reported absence per demo class, so four spots to fill", () => {
    const classes = DEMO_ABSENCES.map((a) => a.class.id);
    expect(new Set(classes).size).toBe(4);
    expect(classes).toContain(CLASSES.dolphin3Wed.id);
    expect(DEMO_ABSENCES.some((a) => a.child === CHILDREN.ava.id)).toBe(false);
  });

  it("carries no activity from another provider", () => {
    for (const child of demoJson.family.children) {
      for (const activity of child.activities) expect(activity.provider).toBe("Aqua House");
    }
  });
});

describe("demo state cookie", () => {
  it("falls back to a fresh demo for anything unreadable", () => {
    expect(parseDemoState(undefined)).toEqual(EMPTY_STATE);
    expect(parseDemoState("not json")).toEqual(EMPTY_STATE);
    expect(parseDemoState(JSON.stringify({ offered: [42] }))).toEqual(EMPTY_STATE);
    expect(parseDemoState(JSON.stringify({ offered: Array(50).fill("c1") }))).toEqual(EMPTY_STATE);
  });

  it("keeps a valid state", () => {
    const valid = state({ offered: ["c1"] });
    expect(parseDemoState(JSON.stringify(valid))).toEqual(valid);
  });
});

describe("fill empty spots (demo until M5)", () => {
  it("marks offered candidates", () => {
    const offered = candidatesFor(CLASSES.dolphin3Wed.id, state({ offered: ["c1"] }));
    expect(offered.map((c) => [c.id, c.offered])).toEqual([
      ["c1", true],
      ["c2", false],
    ]);
  });

  it("knows its candidates", () => {
    expect(isCandidate("c1")).toBe(true);
    expect(isCandidate("someone-else")).toBe(false);
  });
});

describe("routes", () => {
  it("keep the documented addresses working", () => {
    expect(resolveClassId("dolphin-3")).toBe(CLASSES.dolphin3Wed.id);
    expect(classSlug(CLASSES.dolphin3Wed.id)).toBe("dolphin-3");
    expect(resolveClassId(CLASSES.dolphin3Thu.id)).toBe(CLASSES.dolphin3Thu.id);
  });

  it("address children by first name when it's unique in the family", () => {
    const kids = [
      { id: "a", firstName: "Ava" },
      { id: "b", firstName: "Sam" },
      { id: "c", firstName: "Sam" },
    ];
    expect(childSlug(kids[0]!, kids)).toBe("ava");
    expect(childSlug(kids[1]!, kids)).toBe("b");
    expect(resolveChildId("ava", kids)).toBe("a");
    expect(resolveChildId("sam", kids)).toBeNull();
    expect(resolveChildId("c", kids)).toBe("c");
  });
});

describe("demo tenancy", () => {
  const viewer = (patch: Partial<Viewer>): Viewer => ({
    userId: "u",
    name: "Someone",
    email: "x@test",
    shells: [],
    staff: [],
    families: [],
    ...patch,
  });

  it("shows the family demo only to the Burrows family", () => {
    expect(
      isDemoFamily(
        viewer({ families: [{ familyId: FAMILIES.burrows.id, displayName: "Burrows" }] }),
      ),
    ).toBe(true);
    expect(
      isDemoFamily(viewer({ families: [{ familyId: FAMILIES.chen.id, displayName: "Chen" }] })),
    ).toBe(false);
  });

  it("shows the business demo only to Aqua House staff in the right role", () => {
    const aquaOwner = viewer({
      staff: [{ organisationId: ORGS.aqua.id, organisationName: "Aqua House", role: "owner" }],
    });
    const peakOwner = viewer({
      staff: [{ organisationId: ORGS.peak.id, organisationName: "Peak", role: "owner" }],
    });
    expect(isDemoStaff(aquaOwner, "owner")).toBe(true);
    expect(isDemoStaff(aquaOwner, "instructor")).toBe(false);
    expect(isDemoStaff(peakOwner, "owner")).toBe(false);
  });
});
