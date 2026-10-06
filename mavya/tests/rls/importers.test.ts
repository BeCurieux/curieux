import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORGS } from "../../scripts/fixtures";
import type { Database } from "@/lib/supabase/database.types";
import { signInAs, SUPABASE_URL, type Session } from "./helpers";

// M6h acceptance (security and rules): docs/M6_MIGRATION_PILOT.md. Balances
// and make-up credits brought across with an import. Families are added by
// the test's own students rows, so no seeded family's account changes; what
// can't be undone is removed at the end with the server's key.

const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set. Run scripts/local-env.sh.");
const admin = createClient<Database>(SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let owner: Session;
let instructor: Session;
let peakOwner: Session;
let burrows: Session;

type Report = {
  batch_id: string | null;
  added: Record<string, number>;
  existing: Record<string, number>;
  problems: { file: string; row: number; message: string }[];
  money: Record<string, number>;
};

const EMAIL = "pat.balance@example.test";
const PHONE = "0400 999 888";

const kid = (row: number, first: string, extra: Record<string, unknown> = {}) => ({
  row,
  first_name: first,
  last_name: "Balance",
  date_of_birth: "2019-01-01",
  parent_name: "Pat Balance",
  parent_email: EMAIL,
  parent_phone: null,
  class: null,
  class_weekday: null,
  class_time: null,
  ...extra,
});

const STUDENTS = [
  kid(2, "Mo"),
  kid(3, "Lu", { date_of_birth: "2020-02-02" }),
  kid(4, "Ze", { last_name: "Phonely", parent_email: null, parent_phone: PHONE }),
];

const BALANCES = [
  { row: 2, parent_email: EMAIL, parent_phone: null, balance_cents: 12000, due_on: "2026-12-01" },
  { row: 3, parent_email: null, parent_phone: "0400999888", balance_cents: -3000, due_on: null },
  {
    row: 4,
    parent_email: "nobody@example.test",
    parent_phone: null,
    balance_cents: 500,
    due_on: null,
  },
  { row: 5, parent_email: EMAIL, parent_phone: null, balance_cents: 100, due_on: null },
];

const credit = (row: number, first: string, extra: Record<string, unknown> = {}) => ({
  row,
  parent_email: EMAIL,
  parent_phone: null,
  first_name: first,
  last_name: null,
  date_of_birth: null,
  credits: 1,
  expires_on: null,
  ...extra,
});

const CREDITS = [
  credit(2, "Mo", { credits: 2, expires_on: "2099-12-31" }),
  // Found by name across the school, without a parent's contact.
  credit(3, "Ze", { parent_email: null, last_name: "Phonely" }),
  credit(4, "Lu", { expires_on: "2020-01-01" }),
  credit(5, "Nobody"),
  credit(6, "Mo"),
];

const run = (s: Session, commit: boolean, balances = BALANCES, credits = CREDITS) =>
  s.client.rpc("import_school", {
    p_org: ORGS.aqua.id,
    p_classes: [],
    p_students: STUDENTS as never,
    p_file_names: ["students.csv", "balances.csv", "credits.csv"],
    p_commit: commit,
    p_balances: balances as never,
    p_credits: credits as never,
  });

async function family(email: string | null, phone?: string) {
  const query = admin.from("families").select("id").eq("organisation_id", ORGS.aqua.id);
  const { data } = await (email
    ? query.eq("primary_contact_email", email)
    : query.eq("primary_contact_phone", phone!));
  return data?.[0]?.id ?? null;
}

async function cleanUp() {
  for (const id of [await family(EMAIL), await family(null, PHONE)])
    if (id) await admin.from("families").delete().eq("id", id);
}

let batch: string;

beforeAll(async () => {
  [owner, instructor, peakOwner, burrows] = await Promise.all([
    signInAs("aquaOwner"),
    signInAs("aquaInstructor"),
    signInAs("peakOwner"),
    signInAs("burrowsParent"),
  ]);
  await cleanUp();
});

afterAll(cleanUp);

describe("checking balances and credits", () => {
  it("says what would come across, with the totals, and saves nothing", async () => {
    const { data, error } = await run(owner, false);
    expect(error).toBeNull();
    const report = data as unknown as Report;
    expect(report.added).toMatchObject({ families: 2, children: 3, balances: 2, credits: 3 });
    expect(report.money).toEqual({
      owing_families: 1,
      owing_cents: 12000,
      credit_families: 1,
      credit_cents: 3000,
    });
    expect(report.problems).toEqual([
      {
        file: "balances",
        row: 4,
        message: "No family with this email or phone is in Ovyko or the students file.",
      },
      {
        file: "balances",
        row: 5,
        message:
          "This family already has a balance on row 2. Put each family's balance on one row.",
      },
      {
        file: "credits",
        row: 4,
        message: "These credits expired on 1/1/2020, so they don't come across.",
      },
      {
        file: "credits",
        row: 5,
        message: "There's no child called Nobody in Ovyko or the students file.",
      },
      {
        file: "credits",
        row: 6,
        message: "This child already has credits on row 2. Put each child's credits on one row.",
      },
    ]);
    expect(await family(EMAIL)).toBeNull();
  });
});

describe("saving them", () => {
  beforeAll(async () => {
    const { data, error } = await run(owner, true);
    expect(error).toBeNull();
    batch = (data as unknown as Report).batch_id!;
  });

  it("adds what each family owes or is owed to its account", async () => {
    const owes = await family(EMAIL);
    const { data: lines } = await owner.client
      .from("ledger_entries")
      .select("kind, amount_cents, description, due_on, import_batch_id")
      .in("family_id", [owes!, (await family(null, PHONE))!])
      .order("amount_cents");
    expect(lines).toEqual([
      {
        kind: "credit",
        amount_cents: -3000,
        description: "Credit brought across",
        due_on: null,
        import_batch_id: batch,
      },
      {
        kind: "charge",
        amount_cents: 12000,
        description: "Balance brought across",
        due_on: "2026-12-01",
        import_batch_id: batch,
      },
    ]);
  });

  it("adds each child's credits, with their expiry", async () => {
    const { data } = await owner.client
      .from("makeup_credits")
      .select("reason, status, expires_at, children (first_name)")
      .eq("import_batch_id", batch);
    const rows = data as unknown as {
      reason: string;
      status: string;
      expires_at: string;
      children: { first_name: string };
    }[];
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.reason === "imported" && r.status === "available")).toBe(true);
    const mo = rows.filter((r) => r.children.first_name === "Mo");
    expect(mo).toHaveLength(2);
    // The end of 31 December 2099, at the school.
    expect(new Date(mo[0]!.expires_at).toISOString()).toBe("2099-12-31T13:00:00.000Z");
    const ze = rows.find((r) => r.children.first_name === "Ze")!;
    expect(new Date(ze.expires_at).getTime()).toBeGreaterThan(Date.now() + 30 * 86_400_000);
  });

  it("counts them with the import", async () => {
    const { data } = await owner.client.rpc("import_summary", { p_batch: batch });
    expect(data).toMatchObject({ in_ovyko: { balances: 2, credits: 3 }, can_undo: true });
  });

  it("adds nothing when the same files are imported again", async () => {
    const { data } = await run(owner, false);
    const again = data as unknown as Report;
    expect(again.added).toMatchObject({ families: 0, children: 0, balances: 0, credits: 0 });
    expect(again.existing).toMatchObject({ balances: 2, credits: 3 });
    expect(again.money).toMatchObject({ owing_families: 0, credit_families: 0 });
  });
});

describe("who sees them", () => {
  it("only the school's owners, and the family itself", async () => {
    for (const s of [instructor, peakOwner, burrows]) {
      const { data: lines } = await s.client
        .from("ledger_entries")
        .select("id")
        .eq("import_batch_id", batch);
      expect(lines).toEqual([]);
      const { data: credits } = await s.client
        .from("makeup_credits")
        .select("id")
        .eq("import_batch_id", batch);
      expect(credits).toEqual([]);
    }
  });

  it("only the school's owners can bring them across", async () => {
    for (const s of [instructor, peakOwner, burrows])
      expect((await run(s, false)).error?.code).toBe("42501");
  });

  it("nobody can mark a line or a credit as imported by hand", async () => {
    const { data: credits } = await owner.client
      .from("makeup_credits")
      .select("id")
      .eq("import_batch_id", batch)
      .limit(1);
    const { error, data } = await owner.client
      .from("makeup_credits")
      .update({ import_batch_id: null })
      .eq("id", credits![0]!.id)
      .select("id");
    expect(error !== null || data?.length === 0).toBe(true);
    const { error: insert } = await owner.client.from("ledger_entries").insert({
      organisation_id: ORGS.aqua.id,
      family_id: (await family(EMAIL))!,
      kind: "charge",
      amount_cents: 100,
      description: "Sneaky",
      import_batch_id: batch,
    });
    expect(insert?.code).toBe("42501");
  });
});

describe("undo", () => {
  it("removes the balances and credits it added", async () => {
    // A separate import, so the one above stays for the next test.
    const { data } = await owner.client.rpc("import_school", {
      p_org: ORGS.aqua.id,
      p_classes: [],
      p_students: [],
      p_file_names: ["more.csv"],
      p_commit: true,
      p_balances: [] as never,
      p_credits: [] as never,
    });
    const empty = (data as unknown as Report).batch_id!;
    expect((await owner.client.rpc("undo_import", { p_batch: empty })).error).toBeNull();
  });

  it("is refused once a family has paid since, or a credit has been used", async () => {
    const owes = (await family(EMAIL))!;
    const { error: paid } = await owner.client.rpc("record_payment", {
      p_family: owes,
      p_amount_cents: 5000,
      p_method: "cash",
      p_paid_on: new Date().toISOString().slice(0, 10),
    });
    expect(paid).toBeNull();
    const refused = await owner.client.rpc("undo_import", { p_batch: batch });
    expect(refused.error?.hint).toBe("import_locked");
    expect(refused.error?.message).toContain("balances or credits");
  });

  it("undoes a fresh import's balances and credits completely", async () => {
    await cleanUp();
    const { data } = await run(owner, true);
    const fresh = (data as unknown as Report).batch_id!;
    expect((await owner.client.rpc("undo_import", { p_batch: fresh })).error).toBeNull();
    const { count: lines } = await admin
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("import_batch_id", fresh);
    const { count: credits } = await admin
      .from("makeup_credits")
      .select("id", { count: "exact", head: true })
      .eq("import_batch_id", fresh);
    expect([lines, credits]).toEqual([0, 0]);
    expect(await family(EMAIL)).toBeNull();
  });

  it("is refused once a brought-across credit is used", async () => {
    const { data } = await run(owner, true);
    const fresh = (data as unknown as Report).batch_id!;
    const { data: one } = await admin
      .from("makeup_credits")
      .select("id")
      .eq("import_batch_id", fresh)
      .limit(1);
    await admin.from("makeup_credits").update({ status: "revoked" }).eq("id", one![0]!.id);
    const refused = await owner.client.rpc("undo_import", { p_batch: fresh });
    expect(refused.error?.hint).toBe("import_locked");
  });
});
