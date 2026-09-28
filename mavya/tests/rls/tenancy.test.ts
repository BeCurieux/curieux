import { beforeAll, describe, expect, it } from "vitest";
import { CHILDREN, FAMILIES, ORGS, USERS } from "../../scripts/fixtures";
import { anonymous, rawRest, signInAs, TABLES, type Session } from "./helpers";

// M0 acceptance: row level security keeps organisations and families apart.
// Every assertion runs as a real signed-in user through the public API.

const ids = <T extends { id: string }>(rows: T[] | null) => (rows ?? []).map((r) => r.id).sort();

let aquaOwner: Session;
let aquaInstructor: Session;
let peakOwner: Session;
let burrows: Session;
let chen: Session;

beforeAll(async () => {
  [aquaOwner, aquaInstructor, peakOwner, burrows, chen] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
    signInAs("chenParent"),
  ]);
});

describe("1. Owner A cannot read Organisation B", () => {
  it("sees only their own organisation", async () => {
    const { data, error } = await aquaOwner.client.from("organisations").select("id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([ORGS.aqua.id]);
  });

  it("gets nothing when asking for Organisation B by id", async () => {
    const { data } = await aquaOwner.client
      .from("organisations")
      .select("*")
      .eq("id", ORGS.peak.id);
    expect(data).toEqual([]);
  });

  it("sees staff of their own organisation only", async () => {
    const { data } = await aquaOwner.client.from("staff_memberships").select("organisation_id");
    expect(data?.length).toBe(2);
    expect(new Set(data?.map((m) => m.organisation_id))).toEqual(new Set([ORGS.aqua.id]));
  });

  it("and the other way round", async () => {
    const { data } = await peakOwner.client.from("organisations").select("id");
    expect(ids(data)).toEqual([ORGS.peak.id]);
  });
});

describe("2. Parent A cannot read Family B", () => {
  it("sees only their own family", async () => {
    const { data } = await burrows.client.from("families").select("id");
    expect(ids(data)).toEqual([FAMILIES.burrows.id]);
  });

  it("gets nothing when asking for Family B, its members or its children", async () => {
    const family = await burrows.client.from("families").select("*").eq("id", FAMILIES.chen.id);
    const members = await burrows.client
      .from("family_members")
      .select("*")
      .eq("family_id", FAMILIES.chen.id);
    const children = await burrows.client
      .from("children")
      .select("*")
      .eq("family_id", FAMILIES.chen.id);
    expect(family.data).toEqual([]);
    expect(members.data).toEqual([]);
    expect(children.data).toEqual([]);
  });

  it("and the other way round", async () => {
    const { data } = await chen.client.from("children").select("id");
    expect(ids(data)).toEqual([CHILDREN.mei.id]);
  });
});

describe("3. Instructor A cannot access Organisation B", () => {
  it("sees only their own organisation", async () => {
    const { data } = await aquaInstructor.client.from("organisations").select("id");
    expect(ids(data)).toEqual([ORGS.aqua.id]);
  });

  it("gets nothing from Organisation B", async () => {
    const org = await aquaInstructor.client
      .from("organisations")
      .select("*")
      .eq("id", ORGS.peak.id);
    const staff = await aquaInstructor.client
      .from("staff_memberships")
      .select("*")
      .eq("organisation_id", ORGS.peak.id);
    expect(org.data).toEqual([]);
    expect(staff.data).toEqual([]);
  });

  it("sees only their own membership, not the owner's", async () => {
    const { data } = await aquaInstructor.client.from("staff_memberships").select("role");
    expect(data).toEqual([{ role: "instructor" }]);
  });
});

describe("4. A parent can read their own child", () => {
  it("sees both Burrows children and no one else's", async () => {
    const { data, error } = await burrows.client.from("children").select("id, first_name");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([CHILDREN.ava.id, CHILDREN.leo.id].sort());
  });
});

describe("5. Staff are not over-permitted to families before enrolments exist", () => {
  for (const [who, session] of [
    ["owner", () => aquaOwner],
    ["instructor", () => aquaInstructor],
  ] as const) {
    it(`an ${who} sees no families, family members or children`, async () => {
      const { client } = session();
      for (const table of ["families", "family_members", "children"] as const) {
        const { data, error } = await client.from(table).select("id");
        expect(error, table).toBeNull();
        expect(data, table).toEqual([]);
      }
    });
  }

  it("a parent sees no organisations or staff", async () => {
    const orgs = await burrows.client.from("organisations").select("id");
    const staff = await burrows.client.from("staff_memberships").select("id");
    expect(orgs.data).toEqual([]);
    expect(staff.data).toEqual([]);
  });
});

describe("users", () => {
  it("each person reads only their own profile", async () => {
    for (const [session, email] of [
      [aquaOwner, USERS.aquaOwner.email],
      [burrows, USERS.burrowsParent.email],
    ] as const) {
      const { data } = await session.client.from("users").select("email");
      expect(data).toEqual([{ email }]);
    }
  });
});

describe("anonymous visitors", () => {
  it("read nothing from any table", async () => {
    const client = anonymous();
    for (const table of TABLES) {
      const { data, error } = await client.from(table).select("*");
      // Either refused outright or an empty result; never a row.
      expect(data ?? [], table).toEqual([]);
      expect(error?.code, table).toBe("42501");
    }
  });
});

describe("direct API requests cannot bypass RLS", () => {
  it("a parent's own token can't fetch another family's child by id", async () => {
    const { status, body } = await rawRest(
      `children?id=eq.${CHILDREN.mei.id}`,
      burrows.accessToken,
    );
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("an owner's token can't fetch another organisation", async () => {
    const { body } = await rawRest(`organisations?select=*`, aquaOwner.accessToken);
    expect((body as { id: string }[]).map((o) => o.id)).toEqual([ORGS.aqua.id]);
  });

  it("the publishable key alone gets nothing", async () => {
    const { status } = await rawRest("children?select=*");
    expect(status).toBe(401);
  });

  it("a forged token is rejected", async () => {
    const [header, , signature] = burrows.accessToken.split(".");
    const payload = Buffer.from(
      JSON.stringify({ sub: "00000000-0000-0000-0000-000000000000", role: "service_role" }),
    ).toString("base64url");
    const { status } = await rawRest("children?select=*", `${header}.${payload}.${signature}`);
    expect(status).toBe(401);
  });

  it("the access helpers can't be called over the API", async () => {
    const { status } = await rawRest("rpc/is_family_member", burrows.accessToken, {
      method: "POST",
      body: JSON.stringify({ fam_id: FAMILIES.chen.id }),
    });
    expect(status).toBe(404);
  });
});

describe("no writes from the app in M0", () => {
  it("a parent can't add a child, even to their own family", async () => {
    const { error } = await burrows.client.from("children").insert({
      family_id: FAMILIES.burrows.id,
      first_name: "Intruder",
      last_name: "Test",
      date_of_birth: "2020-01-01",
    });
    expect(error?.code).toBe("42501");
  });

  it("a parent can't edit or delete their own child", async () => {
    const update = await burrows.client
      .from("children")
      .update({ first_name: "Changed" })
      .eq("id", CHILDREN.ava.id);
    const remove = await burrows.client.from("children").delete().eq("id", CHILDREN.ava.id);
    expect(update.error?.code).toBe("42501");
    expect(remove.error?.code).toBe("42501");
  });

  it("an owner can't grant themselves into another organisation", async () => {
    const { data: me } = await aquaOwner.client.from("users").select("id").single();
    const { error } = await aquaOwner.client.from("staff_memberships").insert({
      user_id: me!.id,
      organisation_id: ORGS.peak.id,
      role: "owner",
    });
    expect(error?.code).toBe("42501");
  });

  it("a parent can't join another family", async () => {
    const { data: me } = await burrows.client.from("users").select("id").single();
    const { error } = await burrows.client.from("family_members").insert({
      user_id: me!.id,
      family_id: FAMILIES.chen.id,
      relationship: "mother",
    });
    expect(error?.code).toBe("42501");
  });

  it("a user can't rewrite their own profile's auth link", async () => {
    const { error } = await burrows.client
      .from("users")
      .update({ auth_id: "00000000-0000-0000-0000-000000000000" })
      .eq("email", USERS.burrowsParent.email);
    expect(error?.code).toBe("42501");
  });
});
