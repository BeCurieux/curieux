// What we may say to a parent, and what we must be able to show them.
//
// Two jobs here, and the second matters more than the first.
//
// The first is the strip itself: six claims, each linking to the place the
// thing is actually done. The test that every href resolves to a real route
// and a real anchor is what stops it decaying into a badge row — a claim
// whose link 404s has become decoration, and decoration about privacy is
// worse than silence.
//
// The second is a vocabulary guard over the whole source tree. "Military-
// grade encryption", "bank-level security", "100% secure" and invented
// certification shields are not merely tacky; they are claims a company
// cannot keep, made to people who cannot check them, about their children.
// The failure mode is not this file today — it is somebody adding one to a
// pricing page in eighteen months, with good intentions, because the
// conversion rate went up. So the guard runs against src/, not against
// claims.ts.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AT_UPLOAD, CHECKABLE, CLAIMS } from "@/lib/trust/claims";
import { BACKUP_EXPIRY_DAYS } from "@/lib/privacy/erase";

const root = new URL("../src/", import.meta.url).pathname;
const app = `${root}app/`;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = `${dir}${name}`;
    if (statSync(path).isDirectory()) walk(`${path}/`, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const SOURCES = walk(root);
const read = (path: string) => readFileSync(path, "utf8");

/** The App Router file backing a static path, or null. */
function routeFile(pathname: string): string | null {
  const dir = `${app}${pathname.replace(/^\//, "")}`;
  for (const candidate of [`${dir}/page.tsx`, `${dir}/page.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

describe("the strip under the drop zone", () => {
  it("is six things, because twelve reads as a company with something to hide", () => {
    expect(AT_UPLOAD).toHaveLength(6);
  });

  it("covers what a parent handing over their child's photographs asks", () => {
    // Not an arbitrary six. Each of these is a question people actually put
    // to us before uploading, and one missing is the one they leave over.
    expect(AT_UPLOAD.map((c) => c.id)).toEqual([
      "private",
      "not-training",
      "checkable",
      "export",
      "delete",
      "encrypted",
    ]);
  });

  it("keeps every title short enough to be read sideways", () => {
    for (const c of CLAIMS) expect(c.title.length, c.title).toBeLessThanOrEqual(22);
  });

  it("writes every blurb as a sentence, not a slogan", () => {
    for (const c of CLAIMS) {
      expect(c.blurb.endsWith("."), c.blurb).toBe(true);
      expect(c.blurb.length, c.blurb).toBeLessThanOrEqual(120);
    }
  });
});

describe("every claim links to where it is done", () => {
  // The whole difference between this and a badge row.
  it("points at a route that exists", () => {
    for (const c of CLAIMS) {
      const [pathname] = c.href.split("#");
      expect(routeFile(pathname), `${c.id} → ${c.href}`).toBeTruthy();
    }
  });

  it("points at an anchor that exists, where it claims one", () => {
    // A link to #export that lands at the top of a long settings page has
    // told somebody to go and find it themselves.
    for (const c of CLAIMS) {
      const [pathname, anchor] = c.href.split("#");
      if (!anchor) continue;
      const page = read(routeFile(pathname)!);
      expect(page, `${c.id} → #${anchor}`).toContain(`id="${anchor}"`);
    }
  });

  it("says what will be found there", () => {
    for (const c of CLAIMS) expect(c.proof.length, c.id).toBeGreaterThan(10);
  });

  it("takes 'delete means delete' to the button rather than to prose", () => {
    // The one claim where being sent to an explainer instead of a control
    // would be actively insulting.
    const del = CLAIMS.find((c) => c.id === "delete")!;
    const page = read(routeFile(del.href.split("#")[0])!);
    expect(page).toContain('id="delete"');
    expect(page).toMatch(/eraseEverything|deleteEverything|confirmation/);
  });

  it("renders from one list, so the privacy page cannot drift from the strip", () => {
    // Two hand-maintained lists of privacy claims is how a company ends up
    // promising in one place what it stopped doing in the other.
    const page = read(`${app}privacy/page.tsx`);
    expect(page).toContain("CLAIMS");
    expect(page).not.toMatch(/const PILLARS/);
  });
});

describe("what we are not allowed to say", () => {
  // Verbatim from the brief, plus the neighbours of each.
  const FORBIDDEN: [RegExp, string][] = [
    [/military[- ]grade/i, "no honest meaning; it is an advertising phrase"],
    [/bank[- ]level/i, "same, and banks are not a security standard"],
    [/100%\s*secure|totally secure|completely secure|absolutely secure/i, "nobody can promise this"],
    [/unhackable|impenetrable|breach[- ]proof/i, "nobody can promise this either"],
    [/\bcan never be (leaked|breached|hacked|stolen)\b/i, "the promise the privacy page explicitly refuses"],
    [/(SOC ?2|ISO ?27001|HIPAA|GDPR)[- ]?(certified|compliant|approved)/i, "not claimed without an audit"],
    [/\bmilitary\b.{0,20}\bencryption\b/i, "the same claim, spelled around"],
  ];

  // The strings that name the rule are allowed to exist in the two places
  // whose job is to state it. Everywhere else is a finding.
  const EXEMPT = [`${root}lib/trust/claims.ts`, new URL(import.meta.url).pathname];

  it("is nowhere in the source tree", () => {
    const found: string[] = [];
    for (const path of SOURCES) {
      if (EXEMPT.includes(path)) continue;
      const body = read(path);
      for (const [pattern, why] of FORBIDDEN) {
        const hit = body.match(pattern);
        if (hit) found.push(`${path.replace(root, "src/")}: "${hit[0]}" — ${why}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("would notice if somebody added one", () => {
    // A guard nobody has watched fail is not a guard. This is the same
    // lesson as the schema harness that swallowed every error for weeks.
    const pretend = 'We use military-grade encryption and are SOC 2 certified.';
    const caught = FORBIDDEN.filter(([p]) => p.test(pretend));
    expect(caught.length).toBeGreaterThanOrEqual(2);
  });

  it("does not decorate the strip with padlocks or shields", () => {
    // A shield icon is a certification claim drawn instead of written.
    // Word boundaries, or "block" in a class name fails it — a guard that
    // cries wolf gets deleted, and then it is not a guard.
    const strip = read(`${app}trust-strip.tsx`);
    expect(strip).not.toMatch(/\b(padlock|lock|shield|badge|seal|certif\w*)\b|🔒|🛡|✓|✔/i);
  });

  it("would notice a padlock", () => {
    expect(/\b(padlock|lock|shield|badge|seal|certif\w*)\b/i.test('<LockIcon /> lock')).toBe(true);
    expect(/\b(padlock|lock|shield|badge|seal|certif\w*)\b/i.test('className="block"')).toBe(false);
  });
});

describe("what the strip does say", () => {
  const strip = read(`${app}trust-strip.tsx`);

  it("offers to be checked rather than asking to be believed", () => {
    expect(CHECKABLE).toMatch(/link|check/i);
    expect(strip).toContain("CHECKABLE");
  });

  it("makes the claims look like the links they are", () => {
    // The rendered page had six headings in plain ink under a sentence
    // saying every one of them is a link. Only on hover did anything move,
    // which makes the sentence false in the only way a reader can perceive
    // — and a claim about checkability that does not look checkable is the
    // exact failure this strip exists to avoid.
    expect(strip).toMatch(/text-ochre/);
    expect(strip).toMatch(/underline(?!-offset)/);
  });

  it("says encryption exactly as far as it goes", () => {
    // In transit and at rest, and not one adjective further.
    const enc = CLAIMS.find((c) => c.id === "encrypted")!;
    expect(enc.blurb).toMatch(/in transit and at rest/i);
    expect(enc.blurb).not.toMatch(/grade|level|unbreakable|strongest/i);
  });

  it("quotes the retention period the deletion code actually uses", () => {
    // The strip says a number and lib/privacy/erase.ts enforces one. A
    // retention period stated loosely in the promise and precisely in the
    // implementation is how a privacy claim quietly becomes false.
    const del = CLAIMS.find((c) => c.id === "delete")!;
    expect(del.blurb).toContain(String(BACKUP_EXPIRY_DAYS));
  });

  it("makes the narrower, stronger claim about AI", () => {
    // "We don't train on your photos" is table stakes and slightly evasive.
    // The photographs never leave for a model at all, which is the thing
    // being asked.
    const ai = CLAIMS.find((c) => c.id === "not-training")!;
    expect(ai.blurb).toMatch(/never sent|never leave/i);
  });

  it("sits under the drop zone on both upload paths", () => {
    // The backfill path is somebody handing over their child's whole first
    // years in one afternoon. If it is needed anywhere, it is needed there.
    const page = read(`${app}subjects/[subjectId]/upload/page.tsx`);
    expect(page.match(/<TrustStrip/g) ?? []).toHaveLength(2);
  });
});
