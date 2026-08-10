// Sending one story to one person.
//
// The original brief said: *invite family members individually rather than
// generating public share links*. This is a link, so the burden is on the
// code to be a different thing — one frozen story, for a while, revocably,
// never indexed. Most of what follows is that burden.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LIVES_FOR_DAYS, LONGEST_CONTRIBUTION, LONGEST_NAME, MOST_CONTRIBUTIONS,
  TOKEN_SHAPE, accept, expiresAtFrom, newToken, reachable, sayWhy,
} from "@/lib/share/policy";

const NOW = "2027-06-01T12:00:00.000Z";
const live = (patch = {}) => ({
  expiresAt: "2027-06-20T12:00:00.000Z",
  revokedAt: null,
  allowContributions: true,
  contributionCount: 0,
  ...patch,
});

describe("the token", () => {
  it("is long enough that guessing is not a strategy", () => {
    // 128 bits. A loop trying a million a second gets through a meaningful
    // fraction of the space in rather more than the age of the universe.
    const token = newToken();
    expect(token).toHaveLength(22);
    expect(TOKEN_SHAPE.test(token)).toBe(true);
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(seen.size).toBe(500);
  });

  it("survives a URL and an email client without escaping", () => {
    for (let i = 0; i < 200; i++) {
      const token = newToken();
      expect(encodeURIComponent(token)).toBe(token);
    }
  });

  it("refuses anything that is not one, before any lookup", () => {
    for (const bad of ["", "short", "../../etc/passwd", "a".repeat(23), "has spaces here!!!!!!!", "'; drop table--"]) {
      expect(TOKEN_SHAPE.test(bad), bad).toBe(false);
    }
  });
});

describe("a link stops working", () => {
  it("on its own, after about a month", () => {
    expect(LIVES_FOR_DAYS).toBeGreaterThanOrEqual(7);
    expect(LIVES_FOR_DAYS).toBeLessThanOrEqual(90);
    const expires = expiresAtFrom(NOW);
    expect(reachable(live({ expiresAt: expires }), NOW).ok).toBe(true);
    expect(reachable(live({ expiresAt: expires }), "2027-08-01T00:00:00.000Z").ok).toBe(false);
  });

  it("the moment it is pulled back", () => {
    const answer = reachable(live({ revokedAt: "2027-06-02T00:00:00.000Z" }), NOW);
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.because).toBe("revoked");
  });

  it("and says revoked rather than expired when it was both", () => {
    // The two mean different things to whoever is holding the link, and
    // being told the wrong one sends them back to the family with the wrong
    // question.
    const answer = reachable(
      live({ revokedAt: "2027-06-02T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" }),
      NOW
    );
    if (!answer.ok) expect(answer.because).toBe("revoked");
  });

  it("for a token that never existed", () => {
    const answer = reachable(null, NOW);
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.because).toBe("not found");
  });
});

describe("what the recipient is told", () => {
  it("never suggests anything was lost", () => {
    // A grandmother clicking a dead link should not conclude the family's
    // archive is gone.
    expect(sayWhy("expired")).toMatch(/nothing has been deleted/i);
  });

  it("does not say the family withdrew it", () => {
    // That is a sentence that starts an argument at a funeral.
    const said = sayWhy("revoked");
    expect(said).not.toMatch(/withdrew|removed|revoked|blocked|denied/i);
    expect(said).toMatch(/ask whoever sent it/i);
  });

  it("points them back at a person, not at support", () => {
    for (const why of ["expired", "revoked", "not found"] as const) {
      expect(sayWhy(why)).toMatch(/whoever sent it|check the link/i);
    }
  });
});

describe("what somebody with no account may write", () => {
  it("takes a line or two and a name", () => {
    const answer = accept({ name: " Gran ", body: "  We drove to the coast.  " }, 0);
    expect(answer.ok).toBe(true);
    if (answer.ok) {
      expect(answer.name).toBe("Gran");
      expect(answer.body).toBe("We drove to the coast.");
    }
  });

  it("trims rather than bouncing them for a trailing space", () => {
    // This arrives from a person doing us a favour. Every rejection is an
    // answer lost, and the answer is the asset.
    expect(accept({ name: "Gran\n", body: "\tSomething.\n" }, 0).ok).toBe(true);
  });

  it("insists on a name, so the family knows who remembered it", () => {
    const answer = accept({ name: "   ", body: "Something true." }, 0);
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.because).toMatch(/who you are/i);
  });

  it("refuses an empty answer", () => {
    expect(accept({ name: "Gran", body: "   " }, 0).ok).toBe(false);
  });

  it("caps the length, because this is a box on the open internet", () => {
    const essay = "x".repeat(LONGEST_CONTRIBUTION + 1);
    expect(accept({ name: "Gran", body: essay }, 0).ok).toBe(false);
    expect(accept({ name: "Gran", body: "x".repeat(LONGEST_CONTRIBUTION) }, 0).ok).toBe(true);
  });

  it("truncates a silly name rather than refusing it", () => {
    const answer = accept({ name: "G".repeat(500), body: "Something." }, 0);
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.name).toHaveLength(LONGEST_NAME);
  });

  it("stops taking answers after enough of them", () => {
    // Unguessable is not the same as unreachable. The failure mode of no cap
    // is a family opening their archive to four hundred entries about
    // cryptocurrency.
    expect(accept({ name: "Gran", body: "Something." }, MOST_CONTRIBUTIONS).ok).toBe(false);
    expect(reachable(live({ contributionCount: MOST_CONTRIBUTIONS }), NOW)).toEqual({
      ok: true,
      mayContribute: false,
    });
  });

  it("still shows the story when it will take no more", () => {
    // Full means no more answers, not a closed door. Somebody sent this to
    // be looked at.
    const answer = reachable(live({ contributionCount: MOST_CONTRIBUTIONS }), NOW);
    expect(answer.ok).toBe(true);
  });

  it("takes none at all when the family turned them off", () => {
    expect(reachable(live({ allowContributions: false }), NOW)).toEqual({
      ok: true,
      mayContribute: false,
    });
  });
});

describe("the page a stranger can reach", () => {
  const page = readFileSync(
    new URL("../src/app/m/[token]/page.tsx", import.meta.url), "utf8");
  const robots = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");

  it("tells crawlers not to index it", () => {
    expect(page).toMatch(/robots:\s*\{[^}]*index:\s*false/s);
  });

  it("is disallowed in robots.txt as well", () => {
    // Two independent mechanisms. A search engine that indexes one of these
    // has made a family's private story public permanently, and there is no
    // version of "we noticed and took it down" that undoes it.
    expect(robots).toContain('"/m/"');
  });

  it("puts no child's name in the page title", () => {
    // Titles end up in link previews in group chats.
    expect(page).toMatch(/title: BRAND/);
  });

  it("still checks the scan verdict before serving a file", () => {
    // A link being shared is not a reason to serve a file nothing has read.
    expect(page).toContain("SERVABLE_VERDICT");
  });

  it("reads only the ids that were frozen into the share", () => {
    // Not "everything for this subject". The link reaches one story.
    expect(page).toContain("payload.shotIds");
    expect(page).not.toMatch(/\.eq\("subject_id"/);
  });

  it("carries the mark, and it links to what this is", () => {
    expect(page).toMatch(/Remembered with/);
    expect(page).toMatch(/isn&rsquo;t\s*\n?\s*listed or searchable/);
  });
});

describe("what the family sends", () => {
  const actions = readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8");

  it("freezes the story rather than storing a reference", () => {
    // A link that quietly shows something different next month is a link
    // nobody can reason about, and the archive changes constantly.
    expect(actions).toMatch(/payload,/);
    expect(actions).toMatch(/JSON\.parse\(String\(formData\.get\("payload"\)/);
  });

  it("logs the title and never the contents", () => {
    // It goes in a log the whole family reads.
    const shared = actions.slice(actions.indexOf("export async function shareStory"));
    expect(shared).toMatch(/shared .{0,4}\$\{String\(payload\.title\)\.slice\(0, 60\)\}/);
  });
});
