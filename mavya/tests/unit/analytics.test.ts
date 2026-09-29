import { describe, expect, it } from "vitest";
import {
  coarsenPath,
  coarsenUrl,
  sanitiseEventProperties,
  scrubAutomaticProperties,
} from "@/lib/analytics/sanitise";
import { scrubEvent } from "@/lib/observability/scrub";

// Acceptance (M0 security): no sensitive child fields are sent to analytics.

describe("analytics event properties", () => {
  it("keeps only the properties declared for the event", () => {
    const sent = sanitiseEventProperties("shell_viewed", {
      shell: "family",
      first_name: "Ava",
      last_name: "Burrows",
      date_of_birth: "2019-03-14",
      child_id: "0c000000-0000-4000-8000-000000000001",
      email: "sarah.burrows@family.test",
    });
    expect(sent).toEqual({ shell: "family" });
  });

  it("drops declared properties that aren't plain values", () => {
    expect(sanitiseEventProperties("shell_viewed", { shell: { first_name: "Ava" } })).toEqual({});
  });

  it("sends nothing for an undeclared event", () => {
    expect(
      sanitiseEventProperties("child_viewed" as never, { first_name: "Ava", shell: "family" }),
    ).toEqual({});
  });
});

describe("automatic analytics properties", () => {
  it("reduces URLs to their first path segment", () => {
    expect(coarsenUrl("https://app.ovyko.com/family/kids/ava?tab=progress#skills")).toBe(
      "https://app.ovyko.com/family",
    );
    expect(coarsenUrl("https://app.ovyko.com/")).toBe("https://app.ovyko.com/");
    expect(coarsenUrl("not a url")).toBe("");
    expect(coarsenPath("/family/kids/ava?x=1")).toBe("/family");
  });

  it("scrubs every URL-bearing property PostHog adds", () => {
    const scrubbed = scrubAutomaticProperties({
      $current_url: "https://app.ovyko.com/family/kids/ava",
      $pathname: "/family/kids/ava",
      $referrer: "https://app.ovyko.com/business/families/burrows?q=ava",
      $initial_current_url: "https://app.ovyko.com/family/kids/leo",
      $search_query: "ava burrows",
      shell: "family",
    });
    expect(JSON.stringify(scrubbed)).not.toMatch(/ava|leo|burrows/i);
    expect(scrubbed.shell).toBe("family");
  });
});

describe("error reporting", () => {
  it("strips request bodies, cookies, headers, queries and user details", () => {
    const event = scrubEvent({
      request: {
        url: "https://app.ovyko.com/family?child=ava",
        data: { first_name: "Ava" },
        cookies: { "sb-access-token": "secret" },
        headers: { authorization: "Bearer secret" },
        query_string: "child=ava",
      },
      user: { id: "u1", email: "sarah.burrows@family.test", username: "Sarah" },
      extra: { child: "Ava" },
    });
    expect(event).toEqual({
      request: { url: "https://app.ovyko.com/family" },
      user: { id: "u1" },
    });
  });
});
