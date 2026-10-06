import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { USERS } from "../fixtures";

// Step 1 of the demo video: screenshots of the real app, in story order,
// into out/shots. Uses the seeded demo school (Aqua House); what it adds
// (a request for times, an enquiry) it removes again.

const OUT = `${import.meta.dirname}/out/shots`;
const PASSWORD = process.env.SEED_PASSWORD ?? "";
const SIZES = {
  phone: { width: 390, height: 844 },
  laptop: { width: 1200, height: 672 },
  ipad: { width: 820, height: 1180 },
} as const;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function open(browser: Browser, size: keyof typeof SIZES, email?: string) {
  const context = await browser.newContext({
    viewport: SIZES[size],
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  if (email) {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/sign-in$/);
  }
  return page;
}

// A believable month for the demo school, so "This month with Ovyko" and
// Fees show what a school would see: fees paid online, overdue fees paid
// after a reminder, families staying next term, and a term fee for Ava.
// Returns a function that removes it all again.
async function seedMonth(db: ReturnType<typeof admin>, orgId: string) {
  const day = (daysAgo: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const since = Math.max(0, new Date().getDate() - 1);
  const parentId = (
    await db.from("users").select("id").eq("email", USERS.burrowsParent.email).single()
  ).data!.id;
  const families = (
    await db.from("families").select("id").eq("organisation_id", orgId).order("display_name")
  ).data!.map((f) => f.id);
  const burrows = (
    await db
      .from("families")
      .select("id")
      .eq("primary_contact_email", USERS.burrowsParent.email)
      .single()
  ).data!.id;

  const payments = (
    await db
      .from("online_payments")
      .insert(
        families.slice(0, 18).map((family_id, i) => ({
          organisation_id: orgId,
          family_id,
          amount_cents: [24000, 21600, 26400, 24000, 48000][i % 5]!,
          platform_fee_cents: 120,
          status: "paid",
          stripe_account_id: "acct_demo_video",
          method: i % 3 === 0 ? "direct_debit" : "card",
          paid_at: day(i % (since + 1), 9 + (i % 8)),
        })),
      )
      .select("id")
  ).data!.map((r) => r.id);

  const chasedFamilies = families.slice(18, 22);
  const reminders = (
    await db
      .from("email_deliveries")
      .insert(
        chasedFamilies.map((family_id, i) => ({
          kind: "fee_reminder",
          recipient_user_id: parentId,
          organisation_id: orgId,
          payload: { family_id, stage: "overdue" },
          status: "sent",
          sent_at: day(Math.min(since, 3), 7),
          dedupe_key: `demo-video:${i}`,
        })),
      )
      .select("id")
  ).data!.map((r) => r.id);
  const lines = (
    await db
      .from("ledger_entries")
      .insert([
        ...chasedFamilies.map((family_id) => ({
          organisation_id: orgId,
          family_id,
          kind: "payment",
          amount_cents: -24000,
          description: "Bank transfer",
          method: "bank_transfer",
          paid_on: new Date().toISOString().slice(0, 10),
        })),
        {
          organisation_id: orgId,
          family_id: burrows,
          kind: "charge",
          amount_cents: 24000,
          description: "Term 4 · Ava · Dolphin 3 (10 lessons)",
          due_on: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        },
        {
          organisation_id: orgId,
          family_id: burrows,
          kind: "charge",
          amount_cents: 21600,
          description: "Term 4 · Leo · Dolphin 1 (9 lessons)",
          due_on: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        },
      ])
      .select("id")
  ).data!.map((r) => r.id);

  // Card and direct-debit payments, with instalments, switched on.
  const hadAccount = Boolean(
    (await db.from("payment_accounts").select("organisation_id").eq("organisation_id", orgId)).data
      ?.length,
  );
  if (!hadAccount)
    await db.from("payment_accounts").insert({
      organisation_id: orgId,
      stripe_account_id: "acct_demovideo",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });
  await db.from("organisations").update({ instalments_on: true }).eq("id", orgId);

  const year = new Date().getFullYear();
  const { data: term } = await db
    .from("terms")
    .insert({
      organisation_id: orgId,
      name: `Term 1 ${year + 1}`,
      starts_on: `${year + 1}-01-27`,
      ends_on: `${year + 1}-04-03`,
      reply_by: `${year + 1}-01-20`,
      asked_at: day(since),
    })
    .select("id")
    .single();
  const enrolments = (
    await db
      .from("enrolments")
      .select("id, child_id, class_id")
      .eq("organisation_id", orgId)
      .eq("status", "active")
      .limit(26)
  ).data!;
  await db.from("reenrolment_asks").insert(
    enrolments.map((e, i) => ({
      organisation_id: orgId,
      term_id: term!.id,
      enrolment_id: e.id,
      child_id: e.child_id,
      class_id: e.class_id,
      answer: i < 23 ? "stay" : "leave",
      answered_by: parentId,
      answered_at: day(i % (since + 1), 18),
    })),
  );

  return async () => {
    await db.from("organisations").update({ instalments_on: false }).eq("id", orgId);
    if (!hadAccount) await db.from("payment_accounts").delete().eq("organisation_id", orgId);
    await db.from("terms").delete().eq("id", term!.id);
    await db.from("ledger_entries").delete().in("id", lines);
    await db.from("email_deliveries").delete().in("id", reminders);
    await db.from("online_payments").delete().in("id", payments);
  };
}

const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: `${OUT}/${name}.png`, fullPage });

test("capture the demo screens", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const db = admin();
  const org = (await db.from("organisations").select("id").eq("slug", "aqua-house").single()).data!;
  const unseed = await seedMonth(db, org.id);

  // ---------------------------------------------------------------- the parent
  const parent = await open(browser, "phone", USERS.burrowsParent.email);
  await parent.goto("/family/account");
  await parent.getByRole("button", { name: "Reset the demo" }).click();
  await parent.goto("/family");
  await shot(parent, "parent-home");
  await parent.getByRole("link", { name: "Can't make it" }).click();
  await parent.getByRole("group", { name: "Which lesson?" }).locator("label").nth(1).click();
  await parent.getByLabel(/Reason/).fill("Birthday party");
  await parent.evaluate(() => window.scrollTo(0, 0));
  await shot(parent, "parent-absence");
  await parent.getByRole("button", { name: "Confirm absence" }).click();
  await expect(parent).toHaveURL(/\/family\/makeups$/);
  await parent.getByRole("link", { name: /Saturday 9:00am/ }).click();
  await shot(parent, "parent-makeups");
  await parent.getByRole("button", { name: "Confirm booking" }).click();
  await expect(parent.getByRole("status")).toContainText("You're booked in!");
  await shot(parent, "parent-booked");
  await parent.goto("/family/fees");
  await shot(parent, "parent-fees");

  // ---------------------------------------------------------------- the owner
  const owner = await open(browser, "laptop", USERS.aquaOwner.email);
  await shot(owner, "owner-today");
  await owner.goto("/business/fill");
  await shot(owner, "owner-fill");
  await owner.goto("/business/month");
  await shot(owner, "owner-month");

  // Leo would like another time; a class has a place; the owner offers it.
  const leo = (
    await db
      .from("children")
      .select("id, family_id")
      .eq("first_name", "Leo")
      .eq("last_name", "Burrows")
      .single()
  ).data!;
  const { data: wish } = await db
    .from("place_wishes")
    .insert({
      organisation_id: org.id,
      family_id: leo.family_id,
      child_id: leo.id,
      weekdays: [1, 2, 3, 4, 5, 6],
      earliest: "15:00",
      latest: "18:30",
      note: "Saturdays would be easier",
    })
    .select("id")
    .single();
  await db.from("organisations").update({ waitlist_page_on: true }).eq("id", org.id);
  const visitor = await open(browser, "phone");
  await visitor.goto("/waiting-list/aqua-house");
  await visitor.getByLabel("First name").fill("Milo");
  await visitor.getByLabel("Last name").fill("Harbour");
  await visitor.getByLabel("Date of birth").fill("2020-08-12");
  await visitor.getByRole("group", { name: "Days that work" }).getByText("Mon").click();
  await visitor.getByRole("group", { name: "Days that work" }).getByText("Wed").click();
  await visitor.getByLabel("Your name").fill("Sam Harbour");
  await visitor.getByLabel("Email", { exact: true }).fill("sam.harbour@example.test");
  await visitor.getByLabel("Aqua House may keep these details").check();
  await shot(visitor, "family-waiting-list", true);
  await visitor.getByRole("button", { name: "Join the waiting list" }).click();
  await expect(visitor.getByText("Thanks, you're on the list.")).toBeVisible();

  await owner.goto("/business/demand");
  await shot(owner, "owner-demand", true);
  await owner.getByRole("button", { name: "Offer the place" }).first().click();
  await expect(owner.getByRole("region", { name: "Waiting for an answer" })).toBeVisible();
  await owner.goto("/business/settings/import");
  await owner.getByLabel("Students (CSV)").setInputFiles({
    name: "students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Student Name,Born,Primary Guardian Name,Primary Email,Primary Phone Number,Enrolled Class\n" +
        "Kit Harbour,03/04/2019,Lee Harbour,lee@example.test,,Dolphin 3\n",
    ),
  });
  await expect(owner.getByText("Which column has the date of birth?")).toBeVisible();
  await shot(owner, "owner-import", true);

  await parent.goto("/family");
  await expect(parent.getByRole("region", { name: "A place for Leo" })).toBeVisible();
  await shot(parent, "parent-place-offer");

  // ---------------------------------------------------------------- the instructor
  const teacher = await open(browser, "ipad", USERS.aquaInstructor.email);
  await shot(teacher, "instructor-home");
  await teacher.getByRole("link", { name: "Dolphin 3, Wednesday 4:30pm" }).click();
  await teacher.getByRole("button", { name: "Mark Ava Burrows here" }).click();
  await teacher.getByRole("button", { name: "Mark Oliver Chen here" }).click();
  await shot(teacher, "instructor-roll");
  await teacher.getByRole("link", { name: "Ava Burrows" }).click();
  await teacher.getByLabel("Kick 10m: Achieved").check({ force: true });
  await shot(teacher, "instructor-progress");
  await teacher.getByRole("button", { name: "Save progress" }).click();
  await expect(teacher.getByRole("status")).toContainText("Saved");
  await parent.goto("/family/kids/ava");
  await shot(parent, "parent-progress");

  // ---------------------------------------------------------------- put things back
  await teacher.getByLabel("Kick 10m: Developing").check({ force: true });
  await teacher.getByRole("button", { name: "Save progress" }).click();
  await db.from("place_offers").delete().eq("wish_id", wish!.id);
  await db.from("place_wishes").delete().eq("id", wish!.id);
  await db.from("waitlist_enquiries").delete().eq("organisation_id", org.id);
  await db.from("organisations").update({ waitlist_page_on: false }).eq("id", org.id);
  await parent.goto("/family/account");
  await parent.getByRole("button", { name: "Reset the demo" }).click();
  await unseed();
});
