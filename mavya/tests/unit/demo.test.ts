import { describe, expect, it } from "vitest";
import {
  CHILDREN,
  CLASSES,
  DASHBOARD,
  DEMO_FAMILY_ID,
  DEMO_ORG_ID,
  LEVEL_SKILLS,
} from "@/lib/demo/data";
import { levelProgress } from "@/lib/demo/progress";
import {
  allClasses,
  candidatesFor,
  dashboard,
  findChild,
  findClassBySlug,
  isDemoFamily,
  isDemoStaff,
  makeupOptions,
  roster,
} from "@/lib/demo/service";
import { EMPTY_STATE, parseDemoState, type DemoState } from "@/lib/demo/state-schema";
import type { Viewer } from "@/lib/auth/viewer";
import demoJson from "../../seed/demo-data.json";
import { FAMILIES, ORGS } from "../../scripts/fixtures";

const state = (patch: Partial<DemoState> = {}): DemoState => ({ ...EMPTY_STATE, ...patch });

describe("demo data", () => {
  it("belongs to the seeded Aqua House and Burrows family", () => {
    expect(DEMO_ORG_ID).toBe(ORGS.aqua.id);
    expect(DEMO_FAMILY_ID).toBe(FAMILIES.burrows.id);
  });

  it("has temporary vacancies that add up to the dashboard's 4", () => {
    expect(CLASSES.reduce((sum, c) => sum + c.temporaryVacancies, 0)).toBe(4);
    expect(DASHBOARD.temporaryVacancies).toBe(4);
    expect(dashboard(EMPTY_STATE).temporaryVacancies).toBe(4);
  });

  it("carries no activity from another provider", () => {
    for (const child of demoJson.family.children) {
      for (const activity of child.activities) expect(activity.provider).toBe("Aqua House");
    }
  });

  it("has a status for every Dolphin 3 skill", () => {
    const ava = CHILDREN.find((c) => c.slug === "ava")!;
    expect(Object.keys(ava.skills!).sort()).toEqual(LEVEL_SKILLS.map((s) => s.name).sort());
  });
});

describe("level progress", () => {
  it("counts achieved as 1, developing as ½, not started as 0", () => {
    expect(levelProgress(["achieved", "achieved", "developing", "developing", "not_started"])).toBe(
      60,
    );
    expect(levelProgress(["achieved", "achieved", "achieved", "developing", "not_started"])).toBe(
      70,
    );
    expect(levelProgress([])).toBe(0);
  });

  it("is what Ava shows, before and after Kick 10m is achieved", () => {
    expect(findChild("ava", EMPTY_STATE)!.progress).toBe(60);
    expect(findChild("ava", state({ skills: { "Kick 10m": "achieved" } }))!.progress).toBe(70);
  });
});

describe("demo state cookie", () => {
  it("falls back to a fresh demo for anything unreadable", () => {
    expect(parseDemoState(undefined)).toEqual(EMPTY_STATE);
    expect(parseDemoState("not json")).toEqual(EMPTY_STATE);
    expect(parseDemoState(JSON.stringify({ skills: { Floating: "legendary" } }))).toEqual(
      EMPTY_STATE,
    );
    expect(parseDemoState(JSON.stringify({ offered: Array(50).fill("c1") }))).toEqual(EMPTY_STATE);
  });

  it("keeps a valid state", () => {
    const valid = state({ absence: { reason: "Party" }, makeupClassId: "dolphin3-sat" });
    expect(parseDemoState(JSON.stringify(valid))).toEqual(valid);
  });
});

describe("the absence and make-up loop", () => {
  it("opens a spot in Ava's class when she's reported away", () => {
    const away = state({ absence: { reason: "" } });
    const wed = findClassBySlug("dolphin-3", away)!;
    expect(wed.temporaryVacancies).toBe(2);
    expect(wed.absences).toBe(2);
    expect(dashboard(away).reportedAbsences).toBe(DASHBOARD.reportedAbsences + 1);
    expect(roster(away).find((r) => r.slug === "ava")!.status).toBe("reported_away");
  });

  it("offers three make-ups with Thursday as the best fit", () => {
    const options = makeupOptions(state({ absence: { reason: "" } }));
    expect(options.map((o) => o.id)).toEqual(["dolphin3-thu", "dolphin3-sat", "dolphin3-tue"]);
    expect(options.find((o) => o.bestFit)!.id).toBe("dolphin3-thu");
  });

  it("takes the Saturday spot when Ava books it, leaving 4 open overall", () => {
    const booked = state({ absence: { reason: "" }, makeupClassId: "dolphin3-sat" });
    expect(allClasses(booked).find((c) => c.id === "dolphin3-sat")!.temporaryVacancies).toBe(0);
    expect(dashboard(booked).temporaryVacancies).toBe(4);
    expect(findChild("ava", booked)!.makeup!.day).toBe("Saturday");
  });

  it("marks offered candidates", () => {
    const offered = candidatesFor("dolphin3-wed", state({ offered: ["c1"] }));
    expect(offered.map((c) => [c.id, c.offered])).toEqual([
      ["c1", true],
      ["c2", false],
    ]);
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
