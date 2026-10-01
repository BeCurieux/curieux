import { expect, test, type APIRequestContext } from "@playwright/test";
import { USERS } from "../../scripts/fixtures";
import { resetDemo, signIn } from "./helpers";

// M6c acceptance path: docs/M6_MIGRATION_PILOT.md. Emails go to the local
// test mailbox (Mailpit); the test runs the sender the way the database's
// schedule does, then reads what arrived. It writes real offers and invites,
// so it runs once, on the phone project.

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

type Mail = { ID: string; Subject: string; To: { Address: string }[] };

async function inbox(request: APIRequestContext, to: string, subject: string) {
  const response = await request.get(`${MAILPIT}/api/v1/search`, {
    params: { query: `to:"${to}" subject:"${subject}"` },
  });
  return ((await response.json()) as { messages: Mail[] }).messages;
}

async function body(request: APIRequestContext, id: string) {
  const response = await request.get(`${MAILPIT}/api/v1/message/${id}`);
  return ((await response.json()) as { Text: string }).Text;
}

// The path of the first link to `path` in an email, on whatever host it names.
function linkTo(text: string, path: string) {
  const match = new RegExp(`https?://[^\\s]+(${path}[^\\s]*)`).exec(text);
  expect(match, `a link to ${path}`).not.toBeNull();
  return match![1]!;
}

test.describe("reaching families", () => {
  test.beforeEach(async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "writes shared rows");
    await request.delete(`${MAILPIT}/api/v1/messages`);
  });

  test("only the database's schedule can run the sender", async ({ request }) => {
    expect((await request.post("/api/email/deliver")).status()).toBe(401);
    const wrong = await request.post("/api/email/deliver", {
      headers: { Authorization: "Bearer not-the-secret-not-the-secret-0000" },
    });
    expect(wrong.status()).toBe(401);
  });

  test("a spot offered arrives by email, says nothing about the child, and opens the offer", async ({
    page,
    request,
  }) => {
    await signIn(page, USERS.burrowsParent.email);
    await resetDemo(page);
    // Ava's away in two weeks; the engine offers her an open spot at once.
    await page.goto("/family/absence?child=ava");
    await page.getByRole("group", { name: "Which lesson?" }).locator("label").nth(1).click();
    await page.getByRole("button", { name: "Confirm absence" }).click();
    await expect(page).toHaveURL(/\/family\/makeups$/);

    const run = await request.post("/api/email/deliver", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(run.status()).toBe(200);
    expect(((await run.json()) as { sent: number }).sent).toBeGreaterThan(0);

    const [mail] = await inbox(
      request,
      USERS.burrowsParent.email,
      "A spot has opened at Aqua House",
    );
    expect(mail, "the offer email").toBeDefined();
    expect(mail!.Subject).toBe("A spot has opened at Aqua House");
    const text = await body(request, mail!.ID);
    expect(text).not.toContain("Ava");
    await page.goto(linkTo(text, "/family/claim/"));
    await expect(page.getByRole("heading", { name: /^Ava can come / })).toBeVisible();

    // Sent once: running the sender again sends nothing new to this parent.
    await request.post("/api/email/deliver", {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(
      await inbox(request, USERS.burrowsParent.email, "A spot has opened at Aqua House"),
    ).toHaveLength(1);
    await resetDemo(page);
  });

  test("an invite is emailed with its link", async ({ page, request }) => {
    const email = `e2e.invited.${Date.now()}@example.test`;
    await signIn(page, USERS.aquaOwner.email);
    await page.goto("/business/families");
    await page
      .getByRole("link", { name: /Wilson Family/ })
      .first()
      .click();
    const parents = page.getByRole("region", { name: "Parents on Ovyko" });
    await parents.getByLabel("Parent's email").fill(email);
    await parents.getByRole("button", { name: "Make an invite link" }).click();
    await expect(parents.getByRole("status")).toContainText(`Emailed to ${email}`);

    const [mail] = await inbox(request, email, "Aqua House invited you to Ovyko");
    expect(mail, "the invite email").toBeDefined();
    const text = await body(request, mail!.ID);
    expect(text).toContain("join the Wilson family");
    await page.context().clearCookies();
    await page.goto(linkTo(text, "/join/"));
    await expect(
      page.getByRole("heading", { name: "Join the Wilson family on Ovyko" }),
    ).toBeVisible();
  });

  test("a parent turns lesson-day reminders off and on", async ({ page }) => {
    await signIn(page, USERS.martinParent.email);
    await page.goto("/family/account");
    const toggle = page.getByRole("switch", { name: /Lesson-day reminders/ });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await page.reload();
    await expect(toggle).toBeChecked();
  });
});
