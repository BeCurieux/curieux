import { expect, test, type Page } from "@playwright/test";
import { grant } from "./course-fixtures";
import { emailsTo, linkIn } from "./fake-resend";
import { FAKE_STRIPE_BASE } from "./fake-stripe";
import { service, signIn, uniqueEmail } from "./helpers";

// Email (build step 7), end to end against the stand-in Resend server:
// what's sent when, exactly once, and that unsubscribing stops marketing.

const CRON = { authorization: "Bearer e2e-cron-secret-at-least-24-chars" };
const subjects = async (address: string) => (await emailsTo(address)).map((e) => e.subject);
const DAY = 86_400_000;

async function userIdOf(email: string) {
  const { data } = await service.from("profiles").select("user_id").eq("email", email).single();
  return data!.user_id as string;
}

async function buy(page: Page, slug: string) {
  await page.goto(`/checkout/${slug}`);
  await page.getByRole("button", { name: "Continue to secure payment" }).click();
  await expect(page).toHaveURL(new RegExp(`^${FAKE_STRIPE_BASE}/pay/`));
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.getByTestId("purchase-confirmed")).toBeVisible();
}

test("buying Module 0: a receipt and the first onboarding email, once each, then a refund confirmation", async ({
  page,
}) => {
  const email = uniqueEmail("receipt");
  await signIn(page, email);
  await buy(page, "module-0");

  // The webhook and the success page both ran; each email went once.
  await expect
    .poll(() => subjects(email))
    .toEqual(["Your receipt: Module 0", "Module 0, email 1 of 5"]);
  const [receipt, onboarding] = await emailsTo(email);
  expect(receipt!.text).toContain("A$49.00");
  expect(receipt!.text).not.toMatch(/unsubscribe/i);
  expect(onboarding!.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  expect(onboarding!.html).toMatch(/\/unsubscribe\?e=/);
  const { data: events } = await service
    .from("email_events")
    .select("template, sent_at")
    .eq("user_id", await userIdOf(email));
  const templates = events!.map((e) => e.template);
  expect(templates).toHaveLength(2);
  expect(templates).toContain("onboarding_1");
  expect(templates.some((t) => t.startsWith("receipt:"))).toBe(true);
  expect(events!.every((e) => e.sent_at)).toBe(true);

  await page.goto("/account");
  await page.getByText("Refund this purchase").click();
  await page.getByRole("button", { name: /^Refund A\$49\.00$/ }).click();
  await expect(page.getByRole("status").first()).toContainText("Refunded.");
  await expect.poll(() => subjects(email)).toContain("Refunded: Module 0");
  expect((await subjects(email)).filter((s) => s.startsWith("Refunded"))).toHaveLength(1);
});

test("a founding place: the receipt and how to send the verdict for review", async ({ page }) => {
  const email = uniqueEmail("founding-mail");
  await signIn(page, email);
  try {
    await buy(page, "founding");
    await expect
      .poll(() => subjects(email))
      .toEqual([
        "Your receipt: Founding cohort",
        "How to send your verdict for review",
        "Module 0, email 1 of 5",
      ]);
  } finally {
    await service.from("products").update({ places_sold: 0 }).eq("tier", "founding");
  }
});

test("the daily run: needs the secret, nudges a lead on day 2, never twice, and stops when she unsubscribes", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/cron/email")).status()).toBe(401);
  expect(
    (await request.get("/api/cron/email", { headers: { authorization: "Bearer wrong" } })).status(),
  ).toBe(401);

  const email = uniqueEmail("nudge");
  await service.rpc("capture_lead", { p_email: email, p_source: "product_check", p_interests: [] });
  await service
    .from("leads")
    .update({ first_seen: new Date(Date.now() - 2.5 * DAY).toISOString() })
    .eq("email", email);

  const run = await request.get("/api/cron/email", { headers: CRON });
  expect(run.status()).toBe(200);
  await expect.poll(() => subjects(email)).toEqual(["The landed-cost mistake"]);
  await request.get("/api/cron/email", { headers: CRON });
  expect(await subjects(email)).toEqual(["The landed-cost mistake"]);

  // Unsubscribe from the link in the email: it asks first, then stops the nudges.
  const [nudge] = await emailsTo(email);
  const link = linkIn(nudge!, /\/unsubscribe\?e=/);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByText(`Stop course tips and reminders to ${email}?`)).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("status")).toContainText("Done.");
  const { data: suppressed } = await service
    .from("email_suppressions")
    .select("email")
    .eq("email", email);
  expect(suppressed).toHaveLength(1);

  await service
    .from("leads")
    .update({ first_seen: new Date(Date.now() - 5.5 * DAY).toISOString() })
    .eq("email", email);
  await request.get("/api/cron/email", { headers: CRON });
  expect(await subjects(email)).toEqual(["The landed-cost mistake"]);

  // A forged or altered link does nothing.
  await page.goto(link.replace(/^https?:\/\/[^/]+/, "").replace(/t=[^&]+/, "t=forged"));
  await expect(page.getByTestId("unsubscribe-bad")).toBeVisible();
  const forged = new URL(link);
  expect(
    (await request.post(`/api/unsubscribe?e=${forged.searchParams.get("e")}&t=nope`)).status(),
  ).toBe(400);
});

test("onboarding email 2 goes on day 2 of her purchase", async ({ page, request }) => {
  const email = uniqueEmail("day2");
  await signIn(page, email);
  await buy(page, "module-0");
  await expect.poll(() => subjects(email)).toContain("Module 0, email 1 of 5");
  await service
    .from("orders")
    .update({ created_at: new Date(Date.now() - 2.2 * DAY).toISOString() })
    .eq("user_id", await userIdOf(email));
  await request.get("/api/cron/email", { headers: CRON });
  await expect.poll(() => subjects(email)).toContain("Module 0, email 2 of 5");
  expect((await subjects(email)).filter((s) => s.startsWith("Module 0, email"))).toHaveLength(2);
});

test("finishing lesson 0.8 sends what her verdict means, by colour, once", async ({ page }) => {
  const email = uniqueEmail("lesson08");
  await signIn(page, email);
  await grant(email, ["module0"]);
  const userId = await userIdOf(email);
  const { data: mod } = await service.from("modules").select("id").eq("slug", "module-0").single();
  const { data: lesson } = await service
    .from("lessons")
    .insert({
      module_id: mod!.id,
      slug: "e2e-verdict-lesson",
      number: "0.8",
      title: "Your verdict",
      min_tier: "module0",
      position: 8,
    })
    .select("id")
    .single();
  try {
    await service
      .from("verdicts")
      .insert({ user_id: userId, product_name: "Aprons", verdict: "amber" });
    await page.goto("/learn/module-0/e2e-verdict-lesson");
    await page.getByRole("button", { name: "Mark lesson done" }).click();
    await expect.poll(() => subjects(email)).toEqual(["Your verdict is saved"]);
    const [mail] = await emailsTo(email);
    expect(mail!.text).toContain("Amber");
    expect(mail!.text).toContain("Amber means it could work with changes.");
    // Unmark and mark again: still one.
    await page.getByRole("button", { name: "Mark as not done" }).click();
    await page.getByRole("button", { name: "Mark lesson done" }).click();
    await expect(page.getByRole("button", { name: "Mark as not done" })).toBeVisible();
    expect(await subjects(email)).toEqual(["Your verdict is saved"]);
  } finally {
    await service.from("lessons").delete().eq("id", lesson!.id);
  }
});

test("email preferences on the account page turn course emails off and on", async ({ page }) => {
  const email = uniqueEmail("prefs");
  await signIn(page, email);
  await page.goto("/account");
  const box = page.getByLabel(/Course tips and reminders/);
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByRole("button", { name: "Save email preferences" }).click();
  await expect(page).toHaveURL(/emails=off/);
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByLabel(/Course tips and reminders/)).not.toBeChecked();
  expect(
    (await service.from("email_suppressions").select("email").eq("email", email)).data,
  ).toHaveLength(1);
  await page.getByLabel(/Course tips and reminders/).check();
  await page.getByRole("button", { name: "Save email preferences" }).click();
  await expect(page).toHaveURL(/emails=on/);
  await expect(page.getByLabel(/Course tips and reminders/)).toBeChecked();
  expect(
    (await service.from("email_suppressions").select("email").eq("email", email)).data,
  ).toHaveLength(0);
});
