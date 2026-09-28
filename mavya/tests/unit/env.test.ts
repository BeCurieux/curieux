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
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://eu.i.posthog.com");
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
});
