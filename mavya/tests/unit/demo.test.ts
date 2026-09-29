import { describe, expect, it } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";
import {
  AVA_ID,
  AVA_SKILLS,
  DASHBOARD,
  DEMO_CLASS_NUMBERS,
  DEMO_FAMILY_ID,
  DEMO_ORG_ID,
  LEVEL_SKILLS,
  MAKEUP_CLASSES,
  PRIMARY_CLASS_ID,
} from "@/lib/demo/data";
import { levelProgress } from "@/lib/demo/progress";
import {
  candidatesFor,
  childDemo,
  childSlug,
  classSlug,
  dashboard,
  isDemoFamily,
  isDemoStaff,
  makeupOptions,
  resolveChildId,
  resolveClassId,
  rosterStatus,
  withDemo,
} from "@/lib/demo/service";
import { EMPTY_STATE, parseDemoState, type DemoState } from "@/lib/demo/state-schema";
import type { ClassSummary } from "@/lib/domain/timetable";
import demoJson from "../../seed/demo-data.json";
import { CHILDREN, CLASSES, FAMILIES, ORGS, enrolmentRows } from "../../scripts/fixtures";

const state = (patch: Partial<DemoState> = {}): DemoState => ({ ...EMPTY_STATE, ...patch });

// A real class as the domain layer returns it, with the enrolled count the
// seed gives it.
function summary(id: string): ClassSummary {
  const enrolled = enrolmentRows().filter((e) => e.class_id === id).length;
  return {
    id,
    organisationId: ORGS.aqua.id,
    name: "Dolphin 3",
    levelId: "",
    level: "Dolphin 3",
    programId: "",
    program: "Learn to Swim",
    locationId: "",
    location: "Mona Vale",
    timezone: "Australia/Sydney",
    instructorId: null,
    weekday: 3,
    day: "Wednesday",
    shortDay: "Wed",
    startTime: "16:30",
    time: "4:30pm",
    durationMinutes: 30,
    capacity: 14,
    active: true,
    enrolled,
    nextLesson: null,
  };
}

const demoClasses = [
  CLASSES.dolphin3Wed,
  CLASSES.dolphin3Thu,
  CLASSES.dolphin3Sat,
  CLASSES.dolphin3Tue,
].map((c) => summary(c.id));

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
      expect(summary(real.id).enrolled, c.id).toBe(c.enrolled);
    }
  });

  it("has temporary vacancies that add up to the dashboard's 4", () => {
    const total = Object.values(DEMO_CLASS_NUMBERS).reduce(
      (sum, c) => sum + c.temporaryVacancies,
      0,
    );
    expect(total).toBe(4);
    expect(DASHBOARD.temporaryVacancies).toBe(4);
    expect(
      dashboard(
        demoClasses.map((c) => withDemo(c, EMPTY_STATE)),
        EMPTY_STATE,
      ).temporaryVacancies,
    ).toBe(4);
  });

  it("carries no activity from another provider", () => {
    for (const child of demoJson.family.children) {
      for (const activity of child.activities) expect(activity.provider).toBe("Aqua House");
    }
  });

  it("has a status for every Dolphin 3 skill", () => {
    expect(Object.keys(AVA_SKILLS).sort()).toEqual(LEVEL_SKILLS.map((s) => s.name).sort());
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
    expect(childDemo(AVA_ID, EMPTY_STATE).progress).toBe(60);
    expect(childDemo(AVA_ID, state({ skills: { "Kick 10m": "achieved" } })).progress).toBe(70);
  });

  it("gives no demo skills to anyone but Ava", () => {
    expect(childDemo(CHILDREN.leo.id, EMPTY_STATE).skillList).toBeNull();
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
    const valid = state({ absence: { reason: "Party" }, makeupClassId: CLASSES.dolphin3Sat.id });
    expect(parseDemoState(JSON.stringify(valid))).toEqual(valid);
  });
});

describe("the absence and make-up loop", () => {
  it("opens a spot in Ava's class when she's reported away", () => {
    const away = state({ absence: { reason: "" } });
    const wed = withDemo(summary(CLASSES.dolphin3Wed.id), away);
    expect(wed.temporaryVacancies).toBe(2);
    expect(wed.absences).toBe(2);
    expect(wed.expected).toBe(10);
    expect(dashboard([wed], away).reportedAbsences).toBe(DASHBOARD.reportedAbsences + 1);
    expect(rosterStatus(AVA_ID, PRIMARY_CLASS_ID, away).status).toBe("reported_away");
  });

  it("offers three make-ups with Thursday as the best fit", () => {
    const options = makeupOptions();
    expect(options.map((o) => o.id)).toEqual([
      CLASSES.dolphin3Thu.id,
      CLASSES.dolphin3Sat.id,
      CLASSES.dolphin3Tue.id,
    ]);
    expect(options.find((o) => o.bestFit)!.id).toBe(CLASSES.dolphin3Thu.id);
    expect(MAKEUP_CLASSES.find((c) => c.id === CLASSES.dolphin3Sat.id)!.time).toBe("9:00am");
  });

  it("takes the Saturday spot when Ava books it", () => {
    const booked = state({ absence: { reason: "" }, makeupClassId: CLASSES.dolphin3Sat.id });
    const views = demoClasses.map((c) => withDemo(c, booked));
    expect(views.find((c) => c.id === CLASSES.dolphin3Sat.id)!.temporaryVacancies).toBe(0);
    expect(dashboard(views, booked).temporaryVacancies).toBe(4);
    expect(childDemo(AVA_ID, booked).makeup!.day).toBe("Saturday");
  });

  it("marks offered candidates", () => {
    const offered = candidatesFor(CLASSES.dolphin3Wed.id, state({ offered: ["c1"] }));
    expect(offered.map((c) => [c.id, c.offered])).toEqual([
      ["c1", true],
      ["c2", false],
    ]);
  });

  it("leaves classes outside the demo untouched", () => {
    const other = withDemo(summary(CLASSES.gymLevel2Sat.id), state({ absence: { reason: "" } }));
    expect([other.absences, other.temporaryVacancies, other.expected]).toEqual([
      0,
      0,
      other.enrolled,
    ]);
    expect(rosterStatus(CHILDREN.zoe.id, CLASSES.dolphin3Thu.id, EMPTY_STATE).reportedAway).toBe(
      false,
    );
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
