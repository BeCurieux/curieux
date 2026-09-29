import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHILDREN, CLASSES, LOCATIONS, ORGS } from "../../scripts/fixtures";
import { signInAs, type Session } from "./helpers";

// M4 acceptance (security and rules): docs/M4_MAKEUPS.md. Every check runs as
// a real signed-in user through the public API. It uses lessons a week or
// more away, so the demo's next lessons are left as seeded, and takes back
// what it can at the end so a rerun starts clean.

let aquaOwner: Session;
let aquaInstructor: Session;
let aquaCasual: Session;
let peakOwner: Session;
let peakInstructor: Session;
let burrows: Session;
let chen: Session;

// Upcoming lessons, soonest first.
const lessons: Record<string, { id: string; starts_at: string }[]> = {};

async function upcoming(owner: Session, classId: string) {
  const { data, error } = await owner.client
    .from("class_occurrences")
    .select("id, starts_at")
    .eq("class_id", classId)
    .eq("status", "scheduled")
    .gt("starts_at", new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString())
    .order("starts_at");
  if (error) throw error;
  return data;
}

const report = (s: Session, occurrence: string, child: string, reason?: string) =>
  s.client.rpc("report_absence", { p_occurrence: occurrence, p_child: child, p_reason: reason });
const check = (s: Session, credit: string, occurrence: string) =>
  s.client.rpc("check_makeup", { p_credit: credit, p_occurrence: occurrence });
const book = (s: Session, credit: string, occurrence: string) =>
  s.client.rpc("book_makeup", { p_credit: credit, p_occurrence: occurrence });
const setCapacity = (occurrence: string, capacity: number | null) =>
  aquaOwner.client
    .from("class_occurrences")
    .update({ capacity_override: capacity })
    .eq("id", occurrence);
const sydneyDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date(iso));

// What the tests create, to take back at the end.
const absences: { session: () => Session; id: string }[] = [];
let credit1: string;
let credit2: string;

beforeAll(async () => {
  [aquaOwner, aquaInstructor, aquaCasual, peakOwner, peakInstructor, burrows, chen] =
    await Promise.all([
      signInAs("aquaOwner"),
      signInAs("aquaInstructor"),
      signInAs("aquaCasual"),
      signInAs("peakOwner"),
      signInAs("peakInstructor"),
      signInAs("burrowsParent"),
      signInAs("chenParent"),
    ]);
  for (const [key, c] of Object.entries(CLASSES)) {
    lessons[key] = await upcoming(key === "gymLevel2Sat" ? peakOwner : aquaOwner, c.id);
  }
});

afterAll(async () => {
  for (const a of absences.reverse()) {
    await a.session().client.rpc("withdraw_absence", { p_absence: a.id });
  }
});

const lesson = (key: keyof typeof CLASSES, n: number) => lessons[key]![n]!.id;

describe("reporting an absence", () => {
  it("is refused to anyone who isn't the child's family or provider", async () => {
    for (const s of [() => chen, () => peakOwner, () => aquaInstructor]) {
      const { error } = await report(s(), lesson("dolphin3Wed", 1), CHILDREN.ava.id);
      expect(error?.code).toBe("42501");
    }
  });

  it("is refused for a lesson the child isn't in", async () => {
    const { error } = await report(burrows, lesson("dolphin3Thu", 1), CHILDREN.ava.id);
    expect(error?.hint).toBe("not_in_class");
  });

  it("issues a credit that lasts the policy's 60 days, and is audited", async () => {
    const { data, error } = await report(
      burrows,
      lesson("dolphin3Wed", 1),
      CHILDREN.ava.id,
      "Party",
    );
    expect(error).toBeNull();
    const row = data![0]!;
    absences.push({ session: () => burrows, id: row.absence_id });
    expect(row.credit_id).not.toBeNull();
    expect(row.no_credit_reason).toBeNull();
    const days = (Date.parse(row.credit_expires_at!) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(60);
    credit1 = row.credit_id!;

    const { data: me } = await burrows.client.from("users").select("id").single();
    const { data: audit } = await aquaOwner.client
      .from("audit_events")
      .select("actor_user_id")
      .eq("entity_type", "absences")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(audit!.actor_user_id).toBe(me!.id);
  });

  it("can't be reported twice", async () => {
    const { error } = await report(burrows, lesson("dolphin3Wed", 1), CHILDREN.ava.id);
    expect(error?.hint).toBe("already_reported");
  });

  it("stops issuing credits at the policy's maximum, but still records the absence", async () => {
    const second = (await report(burrows, lesson("dolphin3Wed", 2), CHILDREN.ava.id)).data![0]!;
    absences.push({ session: () => burrows, id: second.absence_id });
    credit2 = second.credit_id!;
    expect(credit2).toBeTruthy();

    const third = (await report(burrows, lesson("dolphin3Wed", 3), CHILDREN.ava.id)).data![0]!;
    expect(third.credit_id).toBeNull();
    expect(third.no_credit_reason).toMatch(/already has 2 make-up credits/);
    expect(
      (await burrows.client.rpc("withdraw_absence", { p_absence: third.absence_id })).error,
    ).toBeNull();
  });
});

describe("who sees absences and credits", () => {
  it("another family and another provider see none of them", async () => {
    for (const s of [chen, peakOwner, peakInstructor]) {
      for (const table of ["absences", "makeup_credits", "makeup_bookings"] as const) {
        const { data } = await s.client.from(table).select("id").eq("child_id", CHILDREN.ava.id);
        expect(data, table).toEqual([]);
      }
    }
  });

  it("the class's instructor sees the absence but not the credit; others see neither", async () => {
    const seen = await aquaInstructor.client
      .from("absences")
      .select("id")
      .eq("child_id", CHILDREN.ava.id);
    const credits = await aquaInstructor.client.from("makeup_credits").select("id");
    const casual = await aquaCasual.client.from("absences").select("id");
    expect(seen.data!.length).toBeGreaterThan(0);
    expect(credits.data).toEqual([]);
    expect(casual.data).toEqual([]);
  });

  it("the owner sees their organisation's credits only", async () => {
    const { data } = await aquaOwner.client.from("makeup_credits").select("organisation_id");
    expect(new Set(data!.map((c) => c.organisation_id))).toEqual(new Set([ORGS.aqua.id]));
  });

  it("nobody writes the tables directly", async () => {
    const credit = await burrows.client.from("makeup_credits").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.ava.id,
      reason: "absence",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const absence = await aquaOwner.client.from("absences").insert({
      organisation_id: ORGS.aqua.id,
      child_id: CHILDREN.ava.id,
      occurrence_id: lesson("dolphin3Wed", 4),
    });
    const policy = await aquaOwner.client.from("policy_sets").insert({
      organisation_id: ORGS.aqua.id,
      policy_type: "makeup",
      config_json: {},
      version: 99,
    });
    const update = await burrows.client
      .from("makeup_credits")
      .update({ expires_at: "2099-01-01T00:00:00Z" })
      .eq("id", credit1);
    expect(credit.error?.code).toBe("42501");
    expect(absence.error?.code).toBe("42501");
    expect(policy.error?.code).toBe("42501");
    expect(update.error?.code).toBe("42501");
  });
});

describe("make-up options", () => {
  it("show only same-level lessons in other classes, and nobody else's details", async () => {
    const { data, error } = await burrows.client.rpc("makeup_options", { p_credit: credit1 });
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const o of data!) {
      expect(o.level_name).toBe("Dolphin 3");
      expect(o.class_id).not.toBe(CLASSES.dolphin3Wed.id);
      expect(o.free_places).toBeGreaterThan(0);
      expect(Object.keys(o).sort()).toEqual(
        [
          "class_id",
          "class_name",
          "ends_at",
          "free_places",
          "instructor_first_name",
          "level_name",
          "location_name",
          "occurrence_id",
          "starts_at",
          "timezone",
        ].sort(),
      );
    }
    expect(JSON.stringify(data)).not.toMatch(/Zoe|Oliver|Martin|Chen/);
  });

  it("are refused for someone else's credit", async () => {
    const other = await chen.client.rpc("makeup_options", { p_credit: credit1 });
    const peek = await chen.client.rpc("check_makeup", {
      p_credit: credit1,
      p_occurrence: lesson("dolphin3Thu", 1),
    });
    expect(other.error?.code).toBe("42501");
    expect(peek.error?.code).toBe("42501");
  });

  it("explain each refusal in plain words", async () => {
    const own = (await check(burrows, credit1, lesson("dolphin3Wed", 4))).data!;
    const level = (await check(burrows, credit1, lesson("dolphin1Tue", 1))).data!;
    const far = (await check(burrows, credit1, lesson("dolphin3Thu", 3))).data!;
    expect(own).toContain("Your child is already in that class.");
    expect(level).toContain("That class is a different level.");
    expect(far).toContain("Make-ups can be booked up to 14 days ahead.");
  });

  it("refuse a full lesson", async () => {
    const sat = lesson("dolphin3Sat", 1);
    await setCapacity(sat, 13);
    const full = (await check(burrows, credit1, sat)).data!;
    await setCapacity(sat, null);
    expect(full).toContain("That lesson is full.");
    expect((await check(burrows, credit1, sat)).data).toEqual([]);
  });
});

describe("booking a make-up", () => {
  let booking: string;

  it("books the place, uses the credit, and shows the child to that lesson's instructor", async () => {
    const thu = lesson("dolphin3Thu", 1);
    const { data, error } = await book(burrows, credit1, thu);
    expect(error).toBeNull();
    booking = data!;
    const { data: credit } = await burrows.client
      .from("makeup_credits")
      .select("status")
      .eq("id", credit1)
      .single();
    expect(credit!.status).toBe("redeemed");

    const taught = await aquaInstructor.client
      .from("makeup_bookings")
      .select("child_id")
      .eq("target_occurrence_id", thu)
      .eq("status", "booked");
    const other = await peakInstructor.client.from("makeup_bookings").select("id");
    expect(taught.data).toEqual([{ child_id: CHILDREN.ava.id }]);
    expect(other.data).toEqual([]);
  });

  it("won't use a credit twice, or book a clash", async () => {
    const again = await book(burrows, credit1, lesson("dolphin3Sat", 1));
    expect(again.error?.hint).toBe("makeup_refused");
    expect(again.error?.message).toBe("This credit has already been used.");
    const clash = (await check(burrows, credit2, lesson("dolphin3Thu", 1))).data!;
    expect(clash).toContain("Your child has another lesson at that time.");
  });

  it("keeps the absence while its credit is booked", async () => {
    const { error } = await burrows.client.rpc("withdraw_absence", {
      p_absence: absences[0]!.id,
    });
    expect(error?.hint).toBe("credit_in_use");
  });

  it("returns the credit when cancelled with notice", async () => {
    const { data, error } = await burrows.client.rpc("cancel_makeup", { p_booking: booking });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const again = await burrows.client.rpc("cancel_makeup", { p_booking: booking });
    expect(again.error).not.toBeNull();
  });

  it("gives the last place to only one family, even at once", async () => {
    const sat = lesson("dolphin3Sat", 1);
    // Oliver's family has no account in the seed; the owner acts for them.
    const oliver = (await report(aquaOwner, lesson("dolphin3Wed", 1), CHILDREN.oliver.id))
      .data![0]!;
    absences.push({ session: () => aquaOwner, id: oliver.absence_id });
    await setCapacity(sat, 14); // 13 enrolled: one place left.
    const results = await Promise.all([
      book(burrows, credit2, sat),
      book(aquaOwner, oliver.credit_id!, sat),
    ]);
    const won = results.filter((r) => r.error === null);
    const lost = results.filter((r) => r.error !== null);
    expect(won).toHaveLength(1);
    expect(lost[0]!.error?.message).toBe("That lesson is full.");
    const winner = results[0]!.error === null ? burrows : aquaOwner;
    await winner.client.rpc("cancel_makeup", { p_booking: won[0]!.data! });
    await setCapacity(sat, null);
  });

  it("won't take back an absence once the place has gone", async () => {
    const tue = lesson("dolphin3Tue", 1);
    const away = (await report(aquaOwner, tue, CHILDREN.oliver.id)).data![0]!;
    await setCapacity(tue, 13); // 13 enrolled, Oliver away: one place.
    const { data: placed } = await book(burrows, credit2, tue);
    const { error } = await aquaOwner.client.rpc("withdraw_absence", {
      p_absence: away.absence_id,
    });
    expect(error?.hint).toBe("place_taken");
    await burrows.client.rpc("cancel_makeup", { p_booking: placed! });
    await setCapacity(tue, null);
    expect(
      (await aquaOwner.client.rpc("withdraw_absence", { p_absence: away.absence_id })).error,
    ).toBeNull();
  });
});

describe("cancelling a day's lessons", () => {
  const cancel = (s: Session, date: string) =>
    s.client.rpc("cancel_lessons", { p_location: LOCATIONS.monaVale.id, p_date: date });

  it("is for the location's owner only", async () => {
    const date = sydneyDate(lessons.dolphin3Thu![1]!.starts_at);
    for (const s of [peakOwner, aquaInstructor, burrows]) {
      expect((await cancel(s, date)).error?.code).toBe("42501");
    }
  });

  it("credits every enrolled child, refunds make-ups booked into it and tells families", async () => {
    const thu = lesson("dolphin3Thu", 1);
    const { data: booked } = await book(burrows, credit1, thu);
    const { data: count, error } = await cancel(
      aquaOwner,
      sydneyDate(lessons.dolphin3Thu![1]!.starts_at),
    );
    expect(error).toBeNull();
    expect(count).toBe(1);

    const { data: status } = await aquaOwner.client
      .from("class_occurrences")
      .select("status")
      .eq("id", thu)
      .single();
    const { data: bookingRow } = await burrows.client
      .from("makeup_bookings")
      .select("status")
      .eq("id", booked!)
      .single();
    const { data: credit } = await burrows.client
      .from("makeup_credits")
      .select("status")
      .eq("id", credit1)
      .single();
    const { count: issued } = await aquaOwner.client
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("source_occurrence_id", thu)
      .eq("reason", "lesson_cancelled");
    const { data: told } = await burrows.client
      .from("notifications")
      .select("type, payload_json")
      .eq("type", "lesson_cancelled");
    const { data: notTold } = await chen.client
      .from("notifications")
      .select("id")
      .eq("type", "lesson_cancelled");
    expect(status!.status).toBe("cancelled");
    expect(bookingRow!.status).toBe("cancelled");
    expect(credit!.status).toBe("available");
    expect(issued).toBe(12);
    expect(told!.map((n) => (n.payload_json as { occurrence_id: string }).occurrence_id)).toContain(
      thu,
    );
    expect(notTold).toEqual([]);

    await aquaOwner.client.from("class_occurrences").update({ status: "scheduled" }).eq("id", thu);
  });
});

describe("make-up rules", () => {
  const save = (s: Session, org: string, config: Record<string, unknown>) =>
    s.client.rpc("save_makeup_policy", { p_org: org, p_config: config as never });

  it("are changed by the organisation's owner only", async () => {
    expect((await save(aquaOwner, ORGS.peak.id, {})).error?.code).toBe("42501");
    expect((await save(peakInstructor, ORGS.peak.id, {})).error?.code).toBe("42501");
    expect((await save(chen, ORGS.peak.id, {})).error?.code).toBe("42501");
    expect((await chen.client.rpc("makeup_policy", { p_org: ORGS.aqua.id })).error?.code).toBe(
      "42501",
    );
  });

  it("refuse settings that make no sense", async () => {
    for (const config of [
      { max_active_credits: 0 },
      { credit_validity_days: 1.5 },
      { booking_horizon_days: "soon" },
      { makeups_enabled: "yes" },
    ]) {
      expect((await save(peakOwner, ORGS.peak.id, config)).error?.hint).toBe("invalid_policy");
    }
  });

  it("apply to the next absence, as a new version", async () => {
    const { data: before } = await peakOwner.client
      .from("policy_sets")
      .select("version")
      .eq("active", true)
      .single();
    const { data: version, error } = await save(peakOwner, ORGS.peak.id, {
      minimum_notice_minutes: 10080,
    });
    expect(error).toBeNull();
    expect(version).toBe(before!.version + 1);
    const policy = (await chen.client.rpc("makeup_policy", { p_org: ORGS.peak.id })).data as {
      minimum_notice_minutes: number;
      credit_validity_days: number;
    };
    expect(policy.minimum_notice_minutes).toBe(10080);
    expect(policy.credit_validity_days).toBe(60);

    // Mei's next lesson is under a week away: recorded, but no credit.
    const { data } = await report(chen, lesson("gymLevel2Sat", 0), CHILDREN.mei.id);
    const row = data![0]!;
    expect(row.credit_id).toBeNull();
    expect(row.no_credit_reason).toBe("Make-ups need at least 7 days notice.");
    expect(
      (await chen.client.rpc("withdraw_absence", { p_absence: row.absence_id })).error,
    ).toBeNull();

    await save(peakOwner, ORGS.peak.id, { minimum_notice_minutes: 240 });
  });
});
