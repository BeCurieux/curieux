import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkContent,
  checkDatabase,
  checkEnv,
  checkGst,
  isDraft,
  isPlaceholder,
} from "@/lib/launch/check";
import { isProtected } from "@/proxy";

const ROOT = path.resolve(import.meta.dirname, "../..");

const LIVE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  APP_URL: "https://course.herlittleempire.com",
  STRIPE_SECRET_KEY: "sk_live_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_live",
  SUPPORT_EMAIL: "help@herlittleempire.com",
  RESEND_API_KEY: "re_live",
  EMAIL_FROM: "Her Little Empire <hello@herlittleempire.com>",
  EMAIL_TOKEN_SECRET: "a".repeat(40),
  CRON_SECRET: "b".repeat(30),
  BUNNY_STREAM_LIBRARY_ID: "123",
};

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "launch-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), body);
  }
  return root;
}

describe("launch check: content", () => {
  it("spots draft frontmatter and placeholders", () => {
    expect(isDraft("---\ntitle: Home\ndraft: true\n---\nBody")).toBe(true);
    expect(isDraft("---\ntitle: Home\n---\nBody")).toBe(false);
    expect(isDraft("No frontmatter")).toBe(false);
    expect(isPlaceholder("title: Lesson 0.1 (placeholder)")).toBe(true);
    expect(isPlaceholder("How to price a candle")).toBe(false);
  });

  it("refuses drafts in pages and emails, the starter rubric and placeholder lessons", () => {
    const root = tree({
      "content/pages/home.md": "---\ndraft: true\n---\nx",
      "content/pages/legal/terms.md": "---\ntitle: Terms\n---\nFinal",
      "content/pages/README.md": "---\ndraft: true\n---\nnotes",
      "content/emails/receipt.md": "---\nsubject: Receipt\ndraft: true\n---\nx",
      "content/hype/rubric.json": JSON.stringify({ draft: true, signals: [] }),
      "content/modules/module-0/lesson-0-1.md": "---\ntitle: Lesson 0.1 (placeholder)\n---\nx",
      "content/modules/module-0/lesson-0-2.md": "---\ntitle: Real lesson\n---\nReal",
    });
    expect(checkContent(root).map((f) => f.message)).toEqual([
      "content/pages/home.md is still draft copy (draft: true).",
      "content/emails/receipt.md is still draft copy (draft: true).",
      "content/hype/rubric.json is still the starter word list (draft: true).",
      "content/modules/module-0/lesson-0-1.md is still a placeholder.",
    ]);
  });

  it("passes final content", () => {
    const root = tree({
      "content/pages/home.md": "---\ntitle: Home\n---\nx",
      "content/hype/rubric.json": JSON.stringify({ version: "v1", signals: [] }),
      "content/modules/module-0/lesson-0-1.md": "---\ntitle: Lesson 0.1\n---\nx",
    });
    expect(checkContent(root)).toEqual([]);
  });

  it("lists every draft in this repository today (the founder's copy replaces them)", () => {
    const found = checkContent(ROOT);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((f) => f.level === "fail")).toBe(true);
  });
});

describe("launch check: GST", () => {
  it("finds GST and Stripe tax options", () => {
    const root = tree({
      "content/pages/pricing.md": "Prices include GST.",
      "src/app/checkout/actions.ts": "create({ automatic_tax: { enabled: true } })",
      "src/app/ok.tsx": "Tax isn't added.",
    });
    expect(checkGst(root).map((f) => f.message)).toEqual([
      "content/pages/pricing.md mentions GST.",
      "src/app/checkout/actions.ts sets a Stripe tax option; nothing should add tax.",
    ]);
  });

  it("this repository has none", () => {
    expect(checkGst(ROOT)).toEqual([]);
  });
});

describe("launch check: environment", () => {
  it("passes production's values", () => {
    expect(checkEnv(LIVE)).toEqual([]);
  });

  it("names every missing variable", () => {
    const messages = checkEnv({}).map((f) => f.message);
    for (const name of Object.keys(LIVE).filter((n) => n !== "BUNNY_STREAM_LIBRARY_ID"))
      expect(messages).toContain(`${name} isn't set.`);
    expect(checkEnv({}).find((f) => f.message.startsWith("BUNNY"))?.level).toBe("warn");
  });

  it("refuses test keys, local addresses, stand-ins and example senders", () => {
    const messages = checkEnv({
      ...LIVE,
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_e2e_test",
      APP_URL: "http://localhost:3300",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54521",
      STRIPE_API_BASE: "http://127.0.0.1:12111",
      RESEND_API_KEY: "re_fake",
      EMAIL_FROM: "Her Little Empire <hello@example.com>",
      CRON_SECRET: "short",
      EMAIL_TOKEN_SECRET: "short",
      SUPPORT_EMAIL: "nope",
    }).map((f) => f.message);
    expect(messages).toEqual([
      "APP_URL must be the public https address, not http://localhost:3300.",
      "NEXT_PUBLIC_SUPABASE_URL must be the public https address, not http://127.0.0.1:54521.",
      "STRIPE_SECRET_KEY is a test key; use the live secret key (sk_live_…).",
      "STRIPE_WEBHOOK_SECRET must be the live endpoint's signing secret (whsec_…).",
      "RESEND_API_KEY is the test suite's stand-in.",
      "STRIPE_API_BASE is set: it points at the test suite's stand-in server. Remove it.",
      "EMAIL_FROM is still an example address (Her Little Empire <hello@example.com>).",
      "SUPPORT_EMAIL isn't an email address.",
      "CRON_SECRET is too short; use a random string of 24 characters or more.",
      "EMAIL_TOKEN_SECRET is too short; use a random string of 32 characters or more.",
    ]);
  });
});

describe("launch check: database", () => {
  it("needs live price ids, an admin and lessons", () => {
    expect(
      checkDatabase({
        products: [
          { tier: "free", stripe_price_id_aud: null, stripe_price_id_usd: null },
          { tier: "module0", stripe_price_id_aud: "price_a", stripe_price_id_usd: null },
        ],
        admins: 0,
        lessons: 0,
      }).map((f) => f.message.split(":")[0]),
    ).toEqual([
      "The module0 product has no Stripe price ids",
      "Nobody is an admin",
      "No lessons in the database",
    ]);
    expect(
      checkDatabase({
        products: [{ tier: "course", stripe_price_id_aud: "a", stripe_price_id_usd: "b" }],
        admins: 1,
        lessons: 8,
      }),
    ).toEqual([]);
  });
});

// SPEC.md → Non-negotiables: every gated page and route checks entitlement on
// the server. The proxy's redirect is a convenience; these files must each
// make their own check, so a request that skips the proxy is still refused.

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const APP = path.join(ROOT, "src/app");
const route = (file: string) =>
  "/" +
  path
    .relative(APP, path.dirname(file))
    .split(path.sep)
    .filter((part) => !/^\(.*\)$/.test(part))
    .join("/");

// Pages and routes anyone may open, each for a stated reason.
const PUBLIC = new Map([
  ["/", "the sales page"],
  ["/check", "lead capture"],
  ["/hype", "the free Hype Check"],
  ["/waitlist", "the waitlist"],
  ["/pricing", "prices"],
  ["/legal/[page]", "terms, privacy, refunds"],
  ["/login", "sign in"],
  ["/auth/confirm", "the sign-in link lands here"],
  ["/auth/sign-out", "signing out"],
  ["/unsubscribe", "a signed token, not a session"],
  ["/api/unsubscribe", "a signed token, not a session"],
  ["/api/webhooks/stripe", "a Stripe signature, not a session"],
  ["/api/cron/email", "the CRON_SECRET bearer token"],
]);

const GUARD = /\b(?:requireUser|requireAdmin|currentUser|isAdmin|auth\.getUser)\(/;

describe("every gated page and route checks on the server", () => {
  const entries = walk(APP).filter((f) => /[/\\](?:page\.tsx|route\.ts)$/.test(f));

  it.each(entries.map((f) => [route(f), f]))("%s", (url, file) => {
    if (PUBLIC.has(url)) return;
    expect(isProtected(url) || url.startsWith("/api/"), `${url} isn't behind the proxy`).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(GUARD);
  });

  it("server actions outside the public forms check who's signed in", () => {
    const publicActions = new Set([
      "src/app/login/actions.ts",
      "src/app/unsubscribe/actions.ts",
      "src/app/(public)/hype/actions.ts",
      "src/app/(public)/lead-actions.ts",
    ]);
    const actions = walk(APP).filter(
      (f) => /\.tsx?$/.test(f) && /^["']use server["']/m.test(readFileSync(f, "utf8")),
    );
    expect(actions.length).toBeGreaterThan(5);
    for (const file of actions) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (publicActions.has(rel)) continue;
      const text = readFileSync(file, "utf8");
      // Each exported action, not just the file.
      const bodies = text.split(/^export async function /m).slice(1);
      for (const body of bodies)
        expect(body, `${rel}: ${body.slice(0, body.indexOf("("))}`).toMatch(
          /\b(?:requireUser|currentUser|mustBeAdmin|isAdmin)\(/,
        );
    }
  });
});
