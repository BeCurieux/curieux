/**
 * The workbench is a development tool, and it sits one path off a domain root
 * a merchant reaches by trimming their own shop link.
 *
 * Two things are worth holding. The predicate itself, because it is one
 * boolean between a dev tool and a front door and the `WORKBENCH` escape hatch
 * has to be harder to trip than a typo. And that the page actually calls it —
 * a correct predicate nobody consults is the failure this is most likely to
 * arrive at later.
 */

import { describe, expect, it } from "vitest";
import { workbenchVisible } from "@/lib/workbench";
import Workbench from "@/app/workbench/page";

describe("workbenchVisible", () => {
  it("renders in development", () => {
    expect(workbenchVisible({ NODE_ENV: "development" })).toBe(true);
  });

  it("does not render in a production build", () => {
    expect(workbenchVisible({ NODE_ENV: "production" })).toBe(false);
  });

  it("renders under test, so a suite does not have to know about this", () => {
    expect(workbenchVisible({ NODE_ENV: "test" })).toBe(true);
  });

  it("is on by default when NODE_ENV says nothing", () => {
    // A build without NODE_ENV set is not a production build; `next build`
    // always sets it. Defaulting the other way would hide the tool on the
    // machine it exists for.
    expect(workbenchVisible({})).toBe(true);
  });

  describe("the WORKBENCH escape hatch", () => {
    it("puts the bench back on a deployed build", () => {
      // The case the gate would otherwise make impossible: comparing five
      // moods on a preview URL rather than on the machine that made them.
      expect(workbenchVisible({ NODE_ENV: "production", WORKBENCH: "1" })).toBe(true);
    });

    it.each(["true", "YES", " on "])("accepts %o", (value) => {
      expect(workbenchVisible({ NODE_ENV: "production", WORKBENCH: value })).toBe(true);
    });

    it.each(["0", "false", "no", "", "off", "please"])("does not read %o as on", (value) => {
      // The trap this closes: `WORKBENCH=false` is a string, and a bare
      // truthiness check would switch the tool on for anyone who wrote the
      // variable down to turn it off.
      expect(workbenchVisible({ NODE_ENV: "production", WORKBENCH: value })).toBe(false);
    });

    it("overrides development too, so the variable means one thing", () => {
      expect(workbenchVisible({ NODE_ENV: "development", WORKBENCH: "0" })).toBe(false);
    });
  });
});

describe("the page", () => {
  const withEnv = async (env: Record<string, string | undefined>, run: () => Promise<unknown>) => {
    const saved = { NODE_ENV: process.env.NODE_ENV, WORKBENCH: process.env.WORKBENCH };
    Object.assign(process.env, env);
    for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
    try {
      return await run();
    } finally {
      Object.assign(process.env, saved);
      if (saved.WORKBENCH === undefined) delete process.env.WORKBENCH;
    }
  };

  it("404s in a production build", async () => {
    // `notFound()` works by throwing, which is what makes this assertable
    // without a server. If the call is ever removed the page resolves instead
    // and this fails.
    const error = await withEnv({ NODE_ENV: "production", WORKBENCH: undefined }, () =>
      Workbench().then(
        () => null,
        (e: unknown) => e,
      ),
    );
    expect(error, "the page rendered in production instead of 404ing").not.toBeNull();
    expect(String((error as Error).message)).toContain("NEXT_HTTP_ERROR_FALLBACK");
  });

  it("renders when the bench is on", async () => {
    const result = await withEnv({ NODE_ENV: "development", WORKBENCH: undefined }, () =>
      Workbench().then(
        (element) => element,
        (e: unknown) => e,
      ),
    );
    expect(result, `the page threw with the bench on: ${String((result as Error)?.message)}`).not.toBeInstanceOf(Error);
  });
});
