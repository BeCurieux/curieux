import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("environment validation", () => {
  it("accepts the minimum configuration", () => {
    const env = parsePublicEnv(valid);
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
    // Analytics has no default destination: it stays off until one is chosen.
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBeUndefined();
  });

  it("treats empty optional values as unset", () => {
    const env = parsePublicEnv({
      ...valid,
      NEXT_PUBLIC_SENTRY_DSN: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
    });
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
  });

  it("names what is missing without echoing values", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })).not.toThrow(
      /not a url/,
    );
  });

  it("requires the server secret", () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_SECRET_KEY/);
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_x" }).SUPABASE_SECRET_KEY).toBe(
      "sb_secret_x",
    );
  });

  it("sends no email unless it's set up", () => {
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: "x" }).EMAIL_TRANSPORT).toBe("off");
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: "x", EMAIL_TRANSPORT: "resend" })).toThrow(
      /EMAIL_FROM, APP_URL, CRON_SECRET, RESEND_API_KEY/,
    );
    const env = parseServerEnv({
      SUPABASE_SECRET_KEY: "x",
      EMAIL_TRANSPORT: "resend",
      EMAIL_FROM: "Ovyko <hello@ovyko.com.au>",
      RESEND_API_KEY: "re_x",
      APP_URL: "https://app.ovyko.com.au/",
      CRON_SECRET: "c".repeat(32),
    });
    expect(env.APP_URL).toBe("https://app.ovyko.com.au");
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: "x", CRON_SECRET: "too-short" })).toThrow(
      /CRON_SECRET/,
    );
  });

  it("takes no payments unless Stripe is set up, and checks the keys look right", () => {
    expect(parseServerEnv({ SUPABASE_SECRET_KEY: "x" }).STRIPE_SECRET_KEY).toBeUndefined();
    expect(() =>
      parseServerEnv({ SUPABASE_SECRET_KEY: "x", STRIPE_SECRET_KEY: "sk_test_abc" }),
    ).toThrow(/APP_URL/);
    expect(() =>
      parseServerEnv({
        SUPABASE_SECRET_KEY: "x",
        STRIPE_SECRET_KEY: "pk_test_abc",
        APP_URL: "https://app.ovyko.com.au",
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
    expect(() =>
      parseServerEnv({ SUPABASE_SECRET_KEY: "x", STRIPE_WEBHOOK_SECRET: "nope" }),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
    const env = parseServerEnv({
      SUPABASE_SECRET_KEY: "x",
      STRIPE_SECRET_KEY: "sk_live_abc",
      STRIPE_WEBHOOK_SECRET: "whsec_abc",
      APP_URL: "https://app.ovyko.com.au",
    });
    expect(env.STRIPE_SECRET_KEY).toBe("sk_live_abc");
  });
});
