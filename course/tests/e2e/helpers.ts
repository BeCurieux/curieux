import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "../../playwright.config";

export const service = createClient(
  supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
  supabaseEnv.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** A fresh address per test, so runs never collide and every sign-in is a first sign-in. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

interface MailpitSummary {
  ID: string;
}

/** Waits for the sign-in email to reach the local stack's Mailpit and returns its link. */
export async function magicLinkFor(email: string): Promise<string> {
  const base = supabaseEnv.MAILPIT_URL;
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        if (!search.ok) return undefined;
        const { messages } = (await search.json()) as { messages: MailpitSummary[] };
        const id = messages[0]?.ID;
        if (!id) return undefined;
        const message = (await (await fetch(`${base}/api/v1/message/${id}`)).json()) as {
          HTML: string;
        };
        const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(message.HTML)?.[1];
        link = href?.replaceAll("&amp;", "&");
        return link;
      },
      {
        message: `no sign-in email for ${email} in Mailpit (${base}). Is \`npm run db:start\` running?`,
        timeout: 15_000,
      },
    )
    .toBeTruthy();
  return link!;
}

/** Signs in through the real form and the emailed link. */
export async function signIn(page: Page, email: string, from = "/learn"): Promise<string> {
  await page.goto(from);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = await magicLinkFor(email);
  await page.goto(link);
  return link;
}
