import { describe, expect, it } from "vitest";
import { isAutomatedVisitor } from "@/lib/analytics/automated";

describe("automated visitors", () => {
  it("drops Vercel's deployment checks, crawlers and headless browsers", () => {
    for (const ua of [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; vercel-screenshot/1.0; +https://vercel.com/docs)",
      "vercel-favicon/1.0",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (Windows NT 10.0) Chrome-Lighthouse",
      "curl/8.5.0",
      "",
      null,
    ])
      expect(isAutomatedVisitor(ua), String(ua)).toBe(true);
  });

  it("counts people on phones and desktops, including Instagram's in-app browser", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; en_AU; en; scale=3.00; 1170x2532)",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    ])
      expect(isAutomatedVisitor(ua), ua).toBe(false);
  });
});
