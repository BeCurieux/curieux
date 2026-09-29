import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { LEVELS, LOCATIONS, ORGS, PROGRAMS, USERS } from "../../scripts/fixtures";
import { anonymous, signInAs, type Session } from "./helpers";

// M2.5 acceptance (docs/SECURITY.md): removing a staff member's access, and
// sign-in throttling being out of reach of browsers. Every check runs as a
// real signed-in user through the public API.
//
// Sam Ortiz (aquaCasual) exists for this file. Each test starts by giving
// Sam access back, so the file passes however often it runs.

const SAM = USERS.aquaCasual.staff.membershipId;

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
  ]);
});

async function restoreSam() {
  const { error } = await aquaOwner.client.rpc("restore_staff_member", { p_membership_id: SAM });
  if (error) throw error;
}

async function classTaughtBySam() {
  const { data, error } = await aquaOwner.client
    .from("classes")
    .insert({
      organisation_id: ORGS.aqua.id,
      location_id: LOCATIONS.monaVale.id,
      program_id: PROGRAMS.learnToSwim.id,
      level_id: LEVELS.dolphin2.id,
      instructor_id: SAM,
      name: `Dolphin 2 ${randomUUID().slice(0, 8)}`,
      weekday: 5,
      start_time: "16:00",
      duration_minutes: 30,
      capacity: 6,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("removing a staff member's access", () => {
  it("stops access at once, unassigns their classes, ends their sessions and is audited", async () => {
    await restoreSam();
    const classId = await classTaughtBySam();
    const sam = await signInAs("aquaCasual");

    const before = await sam.client.from("classes").select("id").eq("id", classId);
    expect(before.data).toHaveLength(1);

    const removed = await aquaOwner.client.rpc("remove_staff_member", { p_membership_id: SAM });
    expect(removed.error).toBeNull();

    // The token Sam already holds now reads nothing.
    const [classes, orgs, children] = await Promise.all([
      sam.client.from("classes").select("id"),
      sam.client.from("organisations").select("id"),
      sam.client.from("children").select("id"),
    ]);
    expect(classes.data).toEqual([]);
    expect(orgs.data).toEqual([]);
    expect(children.data).toEqual([]);

    // And it can't be refreshed: the session is gone.
    const refreshed = await sam.client.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();

    const klass = await aquaOwner.client
      .from("classes")
      .select("instructor_id")
      .eq("id", classId)
      .single();
    expect(klass.data?.instructor_id).toBeNull();

    const membership = await aquaOwner.client
      .from("staff_memberships")
      .select("status")
      .eq("id", SAM)
      .single();
    expect(membership.data?.status).toBe("suspended");

    const audit = await aquaOwner.client
      .from("audit_events")
      .select("action, after_json")
      .eq("entity_type", "staff_memberships")
      .eq("entity_id", SAM)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(audit.data?.after_json).toMatchObject({ status: "suspended" });
  });

  it("lets them sign in again, with access, once the owner restores it", async () => {
    await aquaOwner.client.rpc("remove_staff_member", { p_membership_id: SAM });
    await restoreSam();
    const sam = await signInAs("aquaCasual");
    const orgs = await sam.client.from("organisations").select("id");
    expect(orgs.data?.map((o) => o.id)).toEqual([ORGS.aqua.id]);
  });

  it("can't be done by an instructor, another organisation's owner or a visitor", async () => {
    await restoreSam();
    for (const client of [aquaInstructor.client, peakOwner.client, anonymous()]) {
      const { error } = await client.rpc("remove_staff_member", { p_membership_id: SAM });
      expect(error).not.toBeNull();
    }
    const membership = await aquaOwner.client
      .from("staff_memberships")
      .select("status")
      .eq("id", SAM)
      .single();
    expect(membership.data?.status).toBe("active");
  });

  it("won't let an owner remove themselves", async () => {
    const { error } = await aquaOwner.client.rpc("remove_staff_member", {
      p_membership_id: USERS.aquaOwner.staff.membershipId,
    });
    expect(error?.hint).toBe("remove_self");
  });
});

describe("sign-in throttling", () => {
  it("can't be read or reset from a browser", async () => {
    for (const client of [anonymous(), aquaOwner.client]) {
      const allowed = await client.rpc("sign_in_allowed", { p_email: "x@example.test", p_ip: "" });
      expect(allowed.error).not.toBeNull();
      const record = await client.rpc("record_sign_in", {
        p_email: "x@example.test",
        p_ip: "",
        p_succeeded: true,
      });
      expect(record.error).not.toBeNull();
    }
  });
});
