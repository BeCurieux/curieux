import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { brand, PRODUCT_NAME, SITE_URL, url } from "@/config/brand";
import { formatMoney, formatMoneyRange, getMarket, marketForCoordinates } from "@/config/markets";

/**
 * The brief is emphatic: "52 Weekends" is a working name and must not be
 * hard-coded through the application. This suite is the enforcement.
 *
 * The scan below walks the source tree looking for the literal name outside
 * the one file allowed to contain it. If it fails, someone typed the product
 * name into a page instead of importing it — which is exactly the thing that
 * makes a rename expensive.
 */

const SOURCE_ROOT = join(process.cwd(), "src");

/** Files permitted to contain the literal working name. */
const ALLOWED = new Set(["config/brand.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("brand configuration", () => {
  it("exposes every string the brief requires", () => {
    expect(brand.name).toBeTruthy();
    expect(brand.tagline).toBeTruthy();
    expect(brand.domain).toBeTruthy();
    expect(brand.supportEmail).toContain("@");
  });

  it("does not hard-code the working name anywhere in the source tree", () => {
    const offenders: string[] = [];

    for (const file of walk(SOURCE_ROOT)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const rel = relative(SOURCE_ROOT, file).replace(/\\/g, "/");
      if (ALLOWED.has(rel)) continue;

      const contents = readFileSync(file, "utf8");
      if (contents.includes("52 Weekends") || contents.includes("52weekends")) {
        offenders.push(rel);
      }
    }

    expect(offenders, `Hard-coded product name in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("builds absolute URLs from the configured site URL", () => {
    expect(url("/app")).toBe(`${SITE_URL}/app`);
    expect(url("app")).toBe(`${SITE_URL}/app`);
  });

  it("never produces a double slash in a URL", () => {
    expect(url("/app/plans/1")).not.toMatch(/[^:]\/\//);
  });

  it("derives a support address from the domain when none is configured", () => {
    expect(brand.supportEmail.endsWith(brand.domain)).toBe(true);
  });

  it("keeps the product name out of the tagline's meaning", () => {
    // The tagline has to stand on its own: it appears in emails above the
    // wordmark, and reading as an advert for a name that may change is wrong.
    expect(brand.tagline.includes(PRODUCT_NAME)).toBe(false);
  });
});

describe("market configuration", () => {
  it("ships Sydney as a live market with the values the brief specifies", () => {
    const sydney = getMarket("sydney");
    expect(sydney.currency).toBe("AUD");
    expect(sydney.locale).toBe("en-AU");
    expect(sydney.timezone).toBe("Australia/Sydney");
    expect(sydney.distance_units).toBe("metric");
    expect(sydney.live).toBe(true);
  });

  it("keeps other cities configured but not sellable", () => {
    expect(getMarket("london").live).toBe(false);
    expect(getMarket("new_york").live).toBe(false);
  });

  it("recognises a Sydney address as inside the market", () => {
    // Marrickville.
    expect(marketForCoordinates(-33.911, 151.155)?.market_id).toBe("sydney");
  });

  it("returns nothing for somewhere we do not serve", () => {
    // Melbourne is configured but not live, so it must not match.
    expect(marketForCoordinates(-37.8136, 144.9631)).toBeNull();
    // London likewise.
    expect(marketForCoordinates(51.5072, -0.1276)).toBeNull();
  });

  it("formats money in the market's currency, never with a hard-coded symbol", () => {
    const sydney = getMarket("sydney");
    const newYork = getMarket("new_york");
    expect(formatMoney(sydney, 29)).toContain("29");
    expect(formatMoney(sydney, 29)).not.toBe(formatMoney(newYork, 29));
  });

  it("formats a cost range readably", () => {
    const sydney = getMarket("sydney");
    expect(formatMoneyRange(sydney, 0, 30)).toMatch(/^Under/);
    expect(formatMoneyRange(sydney, 65, 85)).toContain("65");
    expect(formatMoneyRange(sydney, 40, 40)).not.toContain("–");
  });
});
