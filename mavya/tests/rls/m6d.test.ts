import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { CHILDREN, USERS } from "../../scripts/fixtures";
import { signInAs, SUPABASE_URL, type Session } from "./helpers";

// M6d part 1 acceptance (security and rules): docs/M6_MIGRATION_PILOT.md.
// Everything a person might try goes through their own session; the secret
// key is only used to tidy up what the tests wrote.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AVA = CHILDREN.ava.id;

let aquaOwner: Session;
let mia: Session; // teaches Ava
let sam: Session; // same school, doesn't teach Ava
let peakOwner: Session;
let peakInstructor: Session;
let burrows: Session; // Ava's mother
let martin: Session; // another family

type Safety = {
  access: string;
  health: { allergies: string | null; medical_notes: string | null } | null;
  restrictions: { id: string; person_name: string; kind: string; details: string | null }[];
};

async function safetyOf(s: Session, child = AVA) {
  const { data, error } = await s.client.rpc("child_safety", { p_child: child });
  return { data: data as unknown as Safety | null, error };
}

async function tidy() {
  await admin.from("child_health").delete().eq("child_id", AVA);
  await admin.from("child_restrictions").delete().eq("child_id", AVA);
  await admin.from("sensitive_views").delete().eq("child_id", AVA);
}

beforeAll(async () => {
  [aquaOwner, mia, sam, peakOwner, peakInstructor, burrows, martin] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("aquaCasual"),
    signInAs("peakOwner"),
    signInAs("peakInstructor"),
    signInAs("burrowsParent"),
    signInAs("martinParent"),
  ]);
  await tidy();
});

afterAll(tidy);

describe("health notes", () => {
  it("a parent adds an allergy; the child's instructor reads it, and the owner sees they looked", async () => {
    const saved = await burrows.client.rpc("save_child_health", {
      p_child: AVA,
      p_allergies: "Peanuts. EpiPen in her bag.",
      p_medical_notes: "",
    });
    expect(saved.error).toBeNull();

    const { data, error } = await safetyOf(mia);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      access: "instructor",
      health: { allergies: "Peanuts. EpiPen in her bag.", medical_notes: null },
    });

    const views = await aquaOwner.client.rpc("child_safety_views", { p_child: AVA });
    expect(views.error).toBeNull();
    expect(views.data!.map((v) => [v.viewer_name, v.viewer_role])).toEqual([
      [USERS.aquaInstructor.name, "instructor"],
    ]);
  });

  it("the parent reads their own child's notes, and that isn't counted as a look", async () => {
    const { data } = await safetyOf(burrows);
    expect(data!.access).toBe("family");
    expect(data!.health!.allergies).toBe("Peanuts. EpiPen in her bag.");
    const views = await aquaOwner.client.rpc("child_safety_views", { p_child: AVA });
    expect(views.data!.every((v) => v.viewer_role !== "family")).toBe(true);
    expect(views.data).toHaveLength(1);
  });

  it("an owner can change them too, and the audit trail says they changed, not what they say", async () => {
    const { data: before } = await aquaOwner.client
      .from("audit_events")
      .select("created_at")
      .eq("entity_type", "child_health")
      .eq("entity_id", AVA)
      .eq("action", "insert")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const saved = await aquaOwner.client.rpc("save_child_health", {
      p_child: AVA,
      p_allergies: "Peanuts. EpiPen in her bag.",
      p_medical_notes: "Mild asthma.",
    });
    expect(saved.error).toBeNull();
    const { data: audit } = await aquaOwner.client
      .from("audit_events")
      .select("action, entity_id, before_json, after_json")
      .eq("entity_type", "child_health")
      .eq("entity_id", AVA)
      .gte("created_at", before!.created_at)
      .order("created_at");
    expect(audit!.map((a) => a.action)).toEqual(["insert", "update"]);
    expect(audit![1]!.after_json).toMatchObject({ has_allergies: true, has_medical_notes: true });
    expect(JSON.stringify(audit)).not.toMatch(/Peanuts|asthma/);
  });

  it("nobody else can read or write them", async () => {
    for (const s of [sam, peakOwner, peakInstructor, martin]) {
      expect((await safetyOf(s)).error?.code).toBe("42501");
      const write = await s.client.rpc("save_child_health", {
        p_child: AVA,
        p_allergies: "x",
        p_medical_notes: "",
      });
      expect(write.error?.code).toBe("42501");
      const flags = await s.client.rpc("safety_flags", { p_children: [AVA] });
      expect(flags.data).toEqual([]);
      expect((await s.client.rpc("child_safety_views", { p_child: AVA })).error?.code).toBe(
        "42501",
      );
    }
    // Instructors read them but don't write them, and don't see who looked.
    const write = await mia.client.rpc("save_child_health", {
      p_child: AVA,
      p_allergies: "x",
      p_medical_notes: "",
    });
    expect(write.error?.code).toBe("42501");
    expect((await mia.client.rpc("child_safety_views", { p_child: AVA })).error?.code).toBe(
      "42501",
    );
  });

  it("refuses notes that are too long", async () => {
    const { error } = await burrows.client.rpc("save_child_health", {
      p_child: AVA,
      p_allergies: "a".repeat(1001),
      p_medical_notes: "",
    });
    expect(error?.hint).toBe("safety_invalid");
  });
});

describe("pickup restrictions", () => {
  let restrictionId: string;

  it("an owner adds one; the instructor sees the warning without the details", async () => {
    const { data, error } = await aquaOwner.client.rpc("add_child_restriction", {
      p_child: AVA,
      p_person: "Jordan Burrows",
      p_kind: "no_collect",
      p_details: "Court order 2026/123. Call Sarah.",
    });
    expect(error).toBeNull();
    restrictionId = data!;

    const owner = await safetyOf(aquaOwner);
    expect(owner.data!.restrictions).toEqual([
      expect.objectContaining({
        person_name: "Jordan Burrows",
        kind: "no_collect",
        details: "Court order 2026/123. Call Sarah.",
      }),
    ]);

    const instructor = await safetyOf(mia);
    expect(instructor.data!.restrictions).toEqual([
      expect.objectContaining({ person_name: "Jordan Burrows", kind: "no_collect", details: null }),
    ]);
    const flags = await mia.client.rpc("safety_flags", { p_children: [AVA] });
    expect(flags.data).toEqual([{ child_id: AVA, has_health: true, has_restriction: true }]);
  });

  it("the child's parents don't see it, not even that there is one", async () => {
    const { data } = await safetyOf(burrows);
    expect(data!.restrictions).toEqual([]);
    const flags = await burrows.client.rpc("safety_flags", { p_children: [AVA] });
    expect(flags.data).toEqual([{ child_id: AVA, has_health: true, has_restriction: false }]);
  });

  it("only owners add or remove them", async () => {
    for (const s of [mia, burrows, peakOwner]) {
      const add = await s.client.rpc("add_child_restriction", {
        p_child: AVA,
        p_person: "Someone",
        p_kind: "no_contact",
        p_details: "",
      });
      expect(add.error?.code).toBe("42501");
      const remove = await s.client.rpc("remove_child_restriction", {
        p_restriction: restrictionId,
      });
      expect(remove.error?.code).toBe("42501");
    }
    expect((await safetyOf(aquaOwner)).data!.restrictions).toHaveLength(1);
  });

  it("removing one takes the warning away", async () => {
    const { error } = await aquaOwner.client.rpc("remove_child_restriction", {
      p_restriction: restrictionId,
    });
    expect(error).toBeNull();
    expect((await safetyOf(mia)).data!.restrictions).toEqual([]);
  });

  it("emptying the notes removes them", async () => {
    await burrows.client.rpc("save_child_health", {
      p_child: AVA,
      p_allergies: " ",
      p_medical_notes: "",
    });
    expect((await safetyOf(burrows)).data!.health).toBeNull();
    const flags = await mia.client.rpc("safety_flags", { p_children: [AVA] });
    expect(flags.data).toEqual([{ child_id: AVA, has_health: false, has_restriction: false }]);
  });
});

describe("the tables", () => {
  it("can't be read or written directly by anyone", async () => {
    for (const s of [aquaOwner, mia, burrows]) {
      for (const table of ["child_health", "child_restrictions", "sensitive_views"] as const) {
        const read = await s.client.from(table).select("*");
        expect(read.error?.code, table).toBe("42501");
      }
      const write = await s.client
        .from("child_health")
        .insert({ child_id: AVA, organisation_id: "00000000-0000-0000-0000-000000000000" });
      expect(write.error?.code).toBe("42501");
    }
  });
});
