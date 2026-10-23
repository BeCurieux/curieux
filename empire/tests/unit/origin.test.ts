import { describe, expect, it } from "vitest";
import { requestOrigin } from "@/lib/auth/origin";

const h = (init: Record<string, string>) => new Headers(init);
const APP = "https://studio.herlittleempire.com";

describe("sign-in links come back to the host she asked from", () => {
  it("uses Vercel's forwarded host and protocol", () => {
    expect(
      requestOrigin(
        h({ "x-forwarded-host": "empire-studio-abc123.vercel.app", "x-forwarded-proto": "https" }),
        APP,
      ),
    ).toBe("https://empire-studio-abc123.vercel.app");
  });

  it("falls back to Host, with the protocol of APP_URL", () => {
    expect(requestOrigin(h({ host: "localhost:3000" }), "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(requestOrigin(h({ host: "www.herlittleempire.com" }), APP)).toBe(
      "https://www.herlittleempire.com",
    );
  });

  it("ignores anything that isn't a plain host, and uses APP_URL", () => {
    expect(requestOrigin(h({}), APP)).toBe(APP);
    expect(requestOrigin(h({ host: "evil.test/path" }), APP)).toBe(APP);
    expect(requestOrigin(h({ host: "a b" }), APP)).toBe(APP);
    expect(
      requestOrigin(h({ "x-forwarded-host": "ok.test", "x-forwarded-proto": "javascript" }), APP),
    ).toBe("https://ok.test");
  });
});
