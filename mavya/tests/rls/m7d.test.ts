import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PUBLISHABLE_KEY, signInAs, SUPABASE_URL, type Client } from "./helpers";

// M7d part 1 acceptance (security and rules): docs/M7_PAYMENTS.md. The
// secret key only sets up a school of the tests' own and tidies it away;
// everything a person might try goes through their own session.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = Date.now();
const password = `vouchers-${run}-password`;
const createdAuthIds: string[] = [];

async function newAccount(email: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  createdAuthIds.push(data.user.id);
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", data.user.id)
    .single();
  return profile!.id;
}

async function signIn(email: string): Promise<Client> {
  const c = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

let orgId: string;
let owner: Client;
let teacher: Client;
let lee: Client;
let ruiz: Client;
let leeFamily: string;
const kids = { ava: "", cy: "" };

beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organisations")
    .insert({
      name: "Vouchers Test Swim",
      slug: `vouchers-test-${run}`,
      activity_type: "swimming",
      owner_two_step_required: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org!.id;
  const ownerId = await newAccount(`vouchers.owner.${run}@example.test`, "Olive Owner");
  const teacherId = await newAccount(`vouchers.teacher.${run}@example.test`, "Tia Teacher");
  const leeId = await newAccount(`vouchers.lee.${run}@example.test`, "Lena Lee");
  const ruizId = await newAccount(`vouchers.ruiz.${run}@example.test`, "Rafa Ruiz");
  await admin.from("staff_memberships").insert([
    { user_id: ownerId, organisation_id: orgId, role: "owner" },
    { user_id: teacherId, organisation_id: orgId, role: "instructor" },
  ]);
  const { data: fams } = await admin
    .from("families")
    .insert([
      { organisation_id: orgId, display_name: `Vouchers Lee ${run}` },
      { organisation_id: orgId, display_name: `Vouchers Ruiz ${run}` },
    ])
    .select("id, display_name");
  leeFamily = fams!.find((f) => f.display_name.includes("Lee"))!.id;
  const ruizFamily = fams!.find((f) => f.display_name.includes("Ruiz"))!.id;
  await admin.from("family_members").insert([
    { family_id: leeFamily, user_id: leeId, relationship: "parent", is_primary_guardian: true },
    { family_id: ruizFamily, user_id: ruizId, relationship: "parent", is_primary_guardian: true },
  ]);
  const { data: children } = await admin
    .from("children")
    .insert([
      {
        organisation_id: orgId,
        family_id: leeFamily,
        first_name: "Ava",
        last_name: "Lee",
        date_of_birth: "2019-03-01",
      },
      {
        organisation_id: orgId,
        family_id: ruizFamily,
        first_name: "Cy",
        last_name: "Ruiz",
        date_of_birth: "2019-03-01",
      },
    ])
    .select("id, first_name");
  kids.ava = children!.find((c) => c.first_name === "Ava")!.id;
  kids.cy = children!.find((c) => c.first_name === "Cy")!.id;
  owner = await signIn(`vouchers.owner.${run}@example.test`);
  teacher = await signIn(`vouchers.teacher.${run}@example.test`);
  lee = await signIn(`vouchers.lee.${run}@example.test`);
  ruiz = await signIn(`vouchers.ruiz.${run}@example.test`);
});

afterAll(async () => {
  await admin.from("organisations").delete().eq("slug", `vouchers-test-${run}`);
  for (const id of createdAuthIds) await admin.auth.admin.deleteUser(id);
});

const submit = (c: Client, child: string, scheme: string, code: string) =>
  c.rpc("submit_voucher", { p_child: child, p_scheme: scheme, p_code: code });

describe("choosing schemes", () => {
  it("parents can't hand over a voucher the school doesn't take", async () => {
    expect((await submit(lee, kids.ava, "nsw_active_creative_kids", "ABCD1234")).error?.hint).toBe(
      "voucher_invalid",
    );
  });

  it("only owners choose, from the real schemes; it's audited", async () => {
    const mine = { p_org: orgId, p_schemes: ["nsw_active_creative_kids"] };
    expect((await lee.rpc("set_voucher_schemes", mine)).error?.code).toBe("42501");
    expect(
      (await owner.rpc("set_voucher_schemes", { p_org: orgId, p_schemes: ["made_up"] })).error
        ?.hint,
    ).toBe("voucher_invalid");
    expect((await owner.rpc("set_voucher_schemes", mine)).error).toBeNull();
    expect((await lee.rpc("my_voucher_schemes", { p_org: orgId })).data).toEqual([
      "nsw_active_creative_kids",
    ]);
    const { data: audit } = await admin
      .from("audit_events")
      .select("after_json")
      .eq("organisation_id", orgId)
      .eq("entity_type", "organisations");
    expect(audit).toEqual([{ after_json: { voucher_schemes: ["nsw_active_creative_kids"] } }]);
  });

  it("other schools' parents don't learn them", async () => {
    const outsider = await signInAs("burrowsParent");
    expect((await outsider.client.rpc("my_voucher_schemes", { p_org: orgId })).data).toBeNull();
  });
});

describe("handing over and redeeming", () => {
  let claim: string;

  it("a parent hands over a voucher for their own child, once", async () => {
    expect((await submit(lee, kids.cy, "nsw_active_creative_kids", "ABCD1234")).error?.code).toBe(
      "42501",
    );
    expect((await submit(lee, kids.ava, "nsw_active_creative_kids", "no")).error?.hint).toBe(
      "voucher_invalid",
    );
    const { data, error } = await submit(lee, kids.ava, "nsw_active_creative_kids", "abcd 1234");
    expect(error).toBeNull();
    claim = data!;
    expect((await submit(lee, kids.ava, "nsw_active_creative_kids", "ABCD1234")).error?.hint).toBe(
      "voucher_used",
    );
    const { data: row } = await lee.from("voucher_claims").select("code, status").single();
    expect(row).toEqual({ code: "ABCD1234", status: "submitted" });
  });

  it("only the family and the school's owners see it", async () => {
    expect((await owner.from("voucher_claims").select("id")).data).toEqual([{ id: claim }]);
    expect((await ruiz.from("voucher_claims").select("id")).data).toEqual([]);
    expect((await teacher.from("voucher_claims").select("id")).data).toEqual([]);
    const outsider = await signInAs("aquaOwner");
    expect(
      (await outsider.client.from("voucher_claims").select("id").eq("id", claim)).data,
    ).toEqual([]);
  });

  it("parents can't redeem their own voucher or change it", async () => {
    expect(
      (await lee.rpc("redeem_voucher", { p_claim: claim, p_amount_cents: 5000 })).error?.code,
    ).toBe("42501");
    const { error } = await lee
      .from("voucher_claims")
      .update({ status: "redeemed" })
      .eq("id", claim);
    expect(error?.code).toBe("42501");
  });

  it("the owner redeems it for at most its value: a credit on the account", async () => {
    expect(
      (await owner.rpc("redeem_voucher", { p_claim: claim, p_amount_cents: 6000 })).error?.hint,
    ).toBe("voucher_invalid");
    const { data: line, error } = await owner.rpc("redeem_voucher", {
      p_claim: claim,
      p_amount_cents: 5000,
    });
    expect(error).toBeNull();
    const { data: credit } = await lee
      .from("ledger_entries")
      .select("id, kind, amount_cents, description, child_id")
      .single();
    expect(credit).toEqual({
      id: line,
      kind: "credit",
      amount_cents: -5000,
      description: "Active and Creative Kids voucher",
      child_id: kids.ava,
    });
    expect(
      (await owner.rpc("redeem_voucher", { p_claim: claim, p_amount_cents: 5000 })).error?.hint,
    ).toBe("voucher_used");
    expect(
      (await owner.rpc("decline_voucher", { p_claim: claim, p_reason: "Too late" })).error?.hint,
    ).toBe("voucher_used");
  });

  it("or declines one with a reason the parent sees", async () => {
    const { data: second } = await submit(lee, kids.ava, "nsw_active_creative_kids", "EFGH5678");
    expect(
      (await owner.rpc("decline_voucher", { p_claim: second!, p_reason: " " })).error?.hint,
    ).toBe("voucher_invalid");
    expect(
      (await owner.rpc("decline_voucher", { p_claim: second!, p_reason: "Already used elsewhere" }))
        .error,
    ).toBeNull();
    const { data } = await lee
      .from("voucher_claims")
      .select("status, decline_reason")
      .eq("id", second!)
      .single();
    expect(data).toEqual({ status: "declined", decline_reason: "Already used elsewhere" });
    // A declined code can be handed over again.
    expect((await submit(lee, kids.ava, "nsw_active_creative_kids", "EFGH5678")).error).toBeNull();
  });

  it("cancelling a voucher's credit puts the voucher back to redeem again", async () => {
    const { data: v } = await owner
      .from("voucher_claims")
      .select("id, ledger_entry_id")
      .eq("code", "ABCD1234")
      .single();
    expect(
      (
        await owner.rpc("cancel_ledger_entry", {
          p_entry: v!.ledger_entry_id!,
          p_reason: "Wrong amount",
        })
      ).error,
    ).toBeNull();
    const { data: back } = await lee
      .from("voucher_claims")
      .select("status, amount_cents")
      .eq("id", v!.id)
      .single();
    expect(back).toEqual({ status: "submitted", amount_cents: null });
    expect(
      (await owner.rpc("redeem_voucher", { p_claim: v!.id, p_amount_cents: 4000 })).error,
    ).toBeNull();
  });
});
