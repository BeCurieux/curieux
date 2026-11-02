import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/next-path";
import { requestOrigin } from "@/lib/auth/origin";
import { isProtected } from "@/proxy";
import { parseServerEnv } from "@/env";

describe("safeNext", () => {
  it("keeps signed-in pages on this site, with their query", () => {
    expect(safeNext("/learn")).toBe("/learn");
    expect(safeNext("/learn/module-0/lesson-1")).toBe("/learn/module-0/lesson-1");
    expect(safeNext("/checkout/module0?bump=1")).toBe("/checkout/module0?bump=1");
    expect(safeNext("/admin")).toBe("/admin");
  });

  it("refuses anything that could leave the site", () => {
    for (const raw of [
      "https://evil.example/learn",
      "//evil.example/learn",
      "/\\evil.example",
      "javascript:alert(1)",
      " /learn/../../x",
      "/learn x",
      "",
      undefined,
      42,
    ]) {
      expect(safeNext(raw)).toBe(DEFAULT_NEXT);
    }
  });

  it("only returns to signed-in areas", () => {
    expect(safeNext("/")).toBe(DEFAULT_NEXT);
    expect(safeNext("/login")).toBe(DEFAULT_NEXT);
    expect(safeNext("/learning-is-fun")).toBe(DEFAULT_NEXT);
  });
});

describe("requestOrigin", () => {
  const fallback = "https://course.example";
  const headers = (init: Record<string, string>) => new Headers(init);

  it("uses the host she asked from", () => {
    expect(
      requestOrigin(
        headers({ host: "preview-abc.vercel.app", "x-forwarded-proto": "https" }),
        fallback,
      ),
    ).toBe("https://preview-abc.vercel.app");
    expect(
      requestOrigin(
        headers({ host: "localhost:3300", "x-forwarded-proto": "http" }),
        "http://localhost:3300",
      ),
    ).toBe("http://localhost:3300");
  });

  it("falls back on a missing or malformed host", () => {
    expect(requestOrigin(headers({}), fallback)).toBe(fallback);
    expect(requestOrigin(headers({ host: "evil.example/path" }), fallback)).toBe(fallback);
  });
});

describe("proxy protection", () => {
  it("covers the signed-in areas and nothing public", () => {
    for (const path of [
      "/learn",
      "/learn/m/l",
      "/tools/landed-cost",
      "/verdict",
      "/account",
      "/checkout/course",
      "/admin",
    ])
      expect(isProtected(path)).toBe(true);
    for (const path of [
      "/",
      "/check",
      "/hype",
      "/pricing",
      "/waitlist",
      "/login",
      "/legal/refunds",
      "/learning",
    ])
      expect(isProtected(path)).toBe(false);
  });
});

describe("environment", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54521",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  };

  it("needs the Supabase URL and publishable key", () => {
    expect(() => parseServerEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(parseServerEnv(base).APP_URL).toBe("http://localhost:3300");
  });

  it("trims a trailing slash from APP_URL", () => {
    expect(parseServerEnv({ ...base, APP_URL: "https://course.example/" }).APP_URL).toBe(
      "https://course.example",
    );
  });
});
