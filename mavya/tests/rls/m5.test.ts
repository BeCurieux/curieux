import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHILDREN, CLASSES, LOCATIONS, ORGS } from "../../scripts/fixtures";
import { anonymous, resetFamily, signInAs, type Session } from "./helpers";

// M5 acceptance (security and rules): docs/M5_FILL_SPOTS.md. Every check runs
// as a real signed-in user through the public API. Ava's absence in two
// weeks gives her a credit; the next Thursday lesson has a spot from its
// seeded absence, which the owner offers her. What the tests book they
// cancel at the end, so a rerun starts clean.

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;
let burrows: Session;
let chen: Session;

const lessons: Record<string, { id: string; starts_at: string }[]> = {};
let avaAbsence: string;
let code: string;
let offerId: string;

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

const lesson = (key: keyof typeof CLASSES, n: number) => lessons[key]![n]!.id;
const offer = (s: Session, occurrence: string, child: string) =>
  s.client.rpc("offer_spot", { p_occurrence: occurrence, p_child: child });
const claim = (s: Session, c: string) => s.client.rpc("claim_offer", { p_code: c });
const setCapacity = (occurrence: string, capacity: number | null) =>
  aquaOwner.client
    .from("class_occurrences")
    .update({ capacity_override: capacity })
    .eq("id", occurrence);
const spotsAt = async (occurrence: string) => {
  const { data } = await aquaOwner.client.rpc("open_spots", { p_org: ORGS.aqua.id, p_days: 14 });
  return data!.find((s) => s.occurrence_id === occurrence)?.spots ?? 0;
};
// The newest offer code the family was sent for this lesson.
async function codeFor(s: Session, occurrence: string) {
  const { data } = await s.client
    .from("notifications")
    .select("payload_json")
    .eq("type", "spot_offered")
    .order("created_at", { ascending: false });
  const p = (data ?? [])
    .map((n) => n.payload_json as { occurrence_id: string; code: string })
    .find((n) => n.occurrence_id === occurrence);
  return p?.code ?? null;
}

// Makes sure `occurrence` has no open offer to `child` left over from an
// earlier run, so a rerun starts clean.
async function declineOpen(s: Session, occurrence: string) {
  const c = await codeFor(s, occurrence);
  if (c) await s.client.rpc("decline_offer", { p_code: c });
}

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner, burrows, chen] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
    signInAs("chenParent"),
  ]);
  for (const [key, c] of Object.entries(CLASSES)) {
    lessons[key] = await upcoming(key === "gymLevel2Sat" ? peakOwner : aquaOwner, c.id);
  }
  await resetFamily(burrows);
  await declineOpen(burrows, lesson("dolphin3Thu", 0));
  const { data, error } = await burrows.client.rpc("report_absence", {
    p_occurrence: lesson("dolphin3Wed", 2),
    p_child: CHILDREN.ava.id,
  });
  if (error) throw error;
  avaAbsence = data[0]!.absence_id;
});

// Cancels Ava's and Zoe's make-ups, which gives their credits back.
async function cancelBookings() {
  const { data } = await aquaOwner.client
    .from("makeup_bookings")
    .select("id")
    .in("child_id", [CHILDREN.ava.id, CHILDREN.zoe.id])
    .eq("status", "booked");
  for (const b of data ?? []) await aquaOwner.client.rpc("cancel_makeup", { p_booking: b.id });
}

afterAll(async () => {
  await cancelBookings();
  await burrows.client.rpc("withdraw_absence", { p_absence: avaAbsence });
  await setCapacity(lesson("dolphin3Thu", 0), null);
});

describe("open spots and candidates", () => {
  it("the owner sees each lesson's open spots; nobody else can ask", async () => {
    const { data, error } = await aquaOwner.client.rpc("open_spots", { p_org: ORGS.aqua.id });
    expect(error).toBeNull();
    expect(data!.reduce((sum, s) => sum + s.spots, 0)).toBe(4);
    for (const s of [peakOwner, aquaInstructor, burrows]) {
      expect((await s.client.rpc("open_spots", { p_org: ORGS.aqua.id })).error?.code).toBe("42501");
    }
  });

  it("candidates are the children whose credits fit, and only the owner sees them", async () => {
    const thu = lesson("dolphin3Thu", 0);
    const { data, error } = await aquaOwner.client.rpc("vacancy_candidates", {
      p_occurrence: thu,
    });
    expect(error).toBeNull();
    const ids = data!.map((c) => c.child_id);
    expect(ids).toContain(CHILDREN.ava.id);
    expect(ids).toContain(CHILDREN.zoe.id);
    // Leo swims Dolphin 1, and has no credit anyway.
    expect(ids).not.toContain(CHILDREN.leo.id);
    for (const s of [peakOwner, aquaInstructor, burrows, chen]) {
      const other = await s.client.rpc("vacancy_candidates", { p_occurrence: thu });
      expect(other.error?.code).toBe("42501");
    }
  });
});

describe("offering a spot", () => {
  it("is for the lesson's owner only", async () => {
    const thu = lesson("dolphin3Thu", 0);
    for (const s of [peakOwner, aquaInstructor, burrows]) {
      expect((await offer(s, thu, CHILDREN.ava.id)).error?.code).toBe("42501");
    }
    // Another school's child can't be offered one either.
    expect((await offer(aquaOwner, thu, CHILDREN.mei.id)).error?.code).toBe("42501");
  });

  it("is refused for a child whose credits don't fit, or a lesson with no open spot", async () => {
    expect((await offer(aquaOwner, lesson("dolphin3Thu", 0), CHILDREN.leo.id)).error?.hint).toBe(
      "makeup_refused",
    );
    expect((await offer(aquaOwner, lesson("dolphin3Sat", 1), CHILDREN.ava.id)).error?.hint).toBe(
      "no_open_spot",
    );
  });

  it("tells the family, with a claim code only they can see", async () => {
    const thu = lesson("dolphin3Thu", 0);
    const { data, error } = await offer(aquaOwner, thu, CHILDREN.ava.id);
    expect(error).toBeNull();
    offerId = data!;
    code = (await codeFor(burrows, thu))!;
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    expect(await codeFor(chen, thu)).toBeNull();
    expect((await offer(aquaOwner, thu, CHILDREN.ava.id)).error?.hint).toBe("already_offered");

    // Only a hash is kept.
    const { data: row } = await aquaOwner.client
      .from("vacancy_offers")
      .select("code_hash")
      .eq("id", offerId)
      .single();
    expect(row!.code_hash).not.toBe(code);
  });

  it("is visible to the family and the owner, not to anyone else", async () => {
    const own = await burrows.client.from("vacancy_offers").select("id").eq("id", offerId);
    const owner = await aquaOwner.client.from("vacancy_offers").select("id").eq("id", offerId);
    expect(own.data).toHaveLength(1);
    expect(owner.data).toHaveLength(1);
    for (const s of [chen, peakOwner, aquaInstructor]) {
      const { data } = await s.client.from("vacancy_offers").select("id");
      expect(data).toEqual([]);
    }
  });

  it("can't be written directly", async () => {
    const insert = await aquaOwner.client.from("vacancy_offers").insert({
      organisation_id: ORGS.aqua.id,
      occurrence_id: lesson("dolphin3Thu", 0),
      child_id: CHILDREN.ava.id,
      code_hash: "x",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const update = await burrows.client
      .from("vacancy_offers")
      .update({ status: "claimed" })
      .eq("id", offerId);
    expect(insert.error?.code).toBe("42501");
    expect(update.error?.code).toBe("42501");
  });
});

describe("an offer's details", () => {
  it("show the lesson to its family, and nobody else's details", async () => {
    const { data, error } = await burrows.client.rpc("offer_details", { p_code: code });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]!.child_first_name).toBe("Ava");
    expect(data![0]!.status).toBe("offered");
    // Never who is away or why.
    expect(JSON.stringify(data)).not.toMatch(/Martin|Zoe|reason/i);
  });

  it("show nothing to another family, a wrong code, or no one signed in", async () => {
    expect((await chen.client.rpc("offer_details", { p_code: code })).data).toEqual([]);
    expect((await burrows.client.rpc("offer_details", { p_code: "0".repeat(64) })).data).toEqual(
      [],
    );
    expect((await anonymous().rpc("offer_details", { p_code: code })).error).not.toBeNull();
  });
});

describe("claiming", () => {
  it("is refused to another family, even with the code", async () => {
    expect((await claim(chen, code)).error?.code).toBe("42501");
    expect((await claim(aquaOwner, code)).error?.code).toBe("42501");
  });

  it("books the spot with the child's credit, once", async () => {
    const thu = lesson("dolphin3Thu", 0);
    const before = await spotsAt(thu);
    const { data, error } = await claim(burrows, code);
    expect(error).toBeNull();
    expect(data![0]!.outcome).toBe("claimed");
    const booking = data![0]!.booking_id!;
    const { data: row } = await burrows.client
      .from("makeup_bookings")
      .select("target_occurrence_id, status, child_id")
      .eq("id", booking)
      .single();
    expect(row).toEqual({ target_occurrence_id: thu, status: "booked", child_id: CHILDREN.ava.id });
    expect(await spotsAt(thu)).toBe(before - 1);

    // The code works once.
    expect((await claim(burrows, code)).data![0]!.outcome).toBe("closed");
    const { data: status } = await burrows.client
      .from("vacancy_offers")
      .select("status")
      .eq("id", offerId)
      .single();
    expect(status!.status).toBe("claimed");

    await burrows.client.rpc("cancel_makeup", { p_booking: booking });
  });

  it("closes the lesson's other offers once no spot is left", async () => {
    const thu = lesson("dolphin3Thu", 0);
    await offer(aquaOwner, thu, CHILDREN.ava.id);
    await offer(aquaOwner, thu, CHILDREN.zoe.id);
    const c = (await codeFor(burrows, thu))!;
    expect((await claim(burrows, c)).data![0]!.outcome).toBe("claimed");
    const { data } = await aquaOwner.client
      .from("vacancy_offers")
      .select("status")
      .eq("occurrence_id", thu)
      .eq("child_id", CHILDREN.zoe.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(data!.status).toBe("filled");
    const { data: mine } = await burrows.client
      .from("makeup_bookings")
      .select("id")
      .eq("target_occurrence_id", thu)
      .eq("status", "booked");
    for (const b of mine ?? []) await burrows.client.rpc("cancel_makeup", { p_booking: b.id });
  });

  it("gives the last place to only one, even at once", async () => {
    const thu = lesson("dolphin3Thu", 0);
    await offer(aquaOwner, thu, CHILDREN.ava.id);
    const c = (await codeFor(burrows, thu))!;
    // 12 enrolled, one away: capacity 12 leaves exactly one place.
    await setCapacity(thu, 12);
    const { data: zoeCredit } = await aquaOwner.client
      .from("makeup_credits")
      .select("id")
      .eq("child_id", CHILDREN.zoe.id)
      .eq("status", "available")
      .limit(1)
      .single();
    const [claimed, booked] = await Promise.all([
      claim(burrows, c),
      aquaOwner.client.rpc("book_makeup", { p_credit: zoeCredit!.id, p_occurrence: thu }),
    ]);
    const claimWon = claimed.data?.[0]?.outcome === "claimed";
    const bookWon = booked.error === null;
    expect(Number(claimWon) + Number(bookWon)).toBe(1);
    if (!claimWon)
      expect(claimed.data?.[0]?.outcome ?? claimed.error?.hint).toMatch(/taken|makeup_refused/);
    await setCapacity(thu, null);
    await cancelBookings();
  });

  it("a declined offer can't then be claimed", async () => {
    const tue = lesson("dolphin3Tue", 0);
    await declineOpen(burrows, tue);
    expect((await offer(aquaOwner, tue, CHILDREN.ava.id)).error).toBeNull();
    const c = (await codeFor(burrows, tue))!;
    expect((await burrows.client.rpc("decline_offer", { p_code: c })).data).toBe(true);
    expect((await claim(burrows, c)).data![0]!.outcome).toBe("closed");
  });
});

describe("the tally", () => {
  it("counts make-ups delivered and families, for the owner only", async () => {
    const { data, error } = await aquaOwner.client.rpc("fill_tally", { p_org: ORGS.aqua.id });
    expect(error).toBeNull();
    expect(data![0]!.makeups_delivered).toBeGreaterThanOrEqual(3);
    expect(data![0]!.families).toBeGreaterThanOrEqual(3);
    expect((await peakOwner.client.rpc("fill_tally", { p_org: ORGS.aqua.id })).error?.code).toBe(
      "42501",
    );
  });
});

describe("cancelling a day", () => {
  it("previews exactly what cancelling does, changing nothing until confirmed", async () => {
    // Four Saturdays out at Narrabeen, so Mei's next lessons stay as seeded.
    const sat = lessons.gymLevel2Sat![3]!;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
      new Date(sat.starts_at),
    );
    const args = { p_location: LOCATIONS.narrabeen.id, p_date: date };
    expect((await aquaOwner.client.rpc("preview_cancel_lessons", args)).error?.code).toBe("42501");

    const { data: preview } = await peakOwner.client.rpc("preview_cancel_lessons", args);
    const p = preview![0]!;
    expect(p.lessons).toBe(1);
    const { data: still } = await peakOwner.client
      .from("class_occurrences")
      .select("status")
      .eq("id", sat.id)
      .single();
    expect(still!.status).toBe("scheduled");

    try {
      await cancelAndCompare(sat.id, args, p);
    } finally {
      await peakOwner.client
        .from("class_occurrences")
        .update({ status: "scheduled" })
        .eq("id", sat.id);
    }
  });

  async function cancelAndCompare(
    satId: string,
    args: { p_location: string; p_date: string },
    p: { lessons: number; credits: number },
  ) {
    const { count: before } = await peakOwner.client
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("source_occurrence_id", satId);
    const { data: cancelled } = await peakOwner.client.rpc("cancel_lessons", args);
    const { count: after } = await peakOwner.client
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("source_occurrence_id", satId);
    expect(cancelled).toBe(p.lessons);
    expect((after ?? 0) - (before ?? 0)).toBe(p.credits);
  }
});

describe("instructor clash check", () => {
  it("refuses a class that puts its instructor in two places at once", async () => {
    // Mia teaches Dolphin 3 on Tuesdays at 5:00pm; Dolphin 1 at 5:30pm.
    const { error } = await aquaOwner.client
      .from("classes")
      .update({ start_time: "17:00" })
      .eq("id", CLASSES.dolphin1Tue.id);
    expect(error?.hint).toBe("instructor_clash");
    expect(error?.message).toBe(
      "Mia already teaches Dolphin 3 at 5:00pm on Tuesdays at Mona Vale.",
    );
    const { data } = await aquaOwner.client
      .from("classes")
      .select("start_time")
      .eq("id", CLASSES.dolphin1Tue.id)
      .single();
    expect(data!.start_time).toBe("17:30:00");
  });

  it("allows back-to-back classes", async () => {
    const { error } = await aquaOwner.client
      .from("classes")
      .update({ start_time: "17:30" })
      .eq("id", CLASSES.dolphin1Tue.id);
    expect(error).toBeNull();
  });
});
