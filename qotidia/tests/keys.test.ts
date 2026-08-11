// Which key, under which name — and who is allowed to ask.
//
// Supabase renamed its API keys: `anon` became **publishable** and
// `service_role` became **secret**. Both still work; only the names on the
// dashboard changed. lib/supabase/keys.ts accepts either spelling, which is
// the whole reason it exists.
//
// The bug this guards against is not a missing key. It is a file that
// reaches past keys.ts and reads `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
// itself. Three did — sign-up, sign-in, the session route and the step-up
// check — so a project set up from today's dashboard, with the key stored
// under the name the dashboard actually gives it, worked everywhere except
// logging in. It failed with `supabaseKey is required` pointing at a line
// inside the framework, on the one screen where nobody can get past it.
//
// Nothing caught it because every test and every check used keys.ts.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publishableKey, projectUrl, secretKey, whatIsMissing } from "@/lib/supabase/keys";

const SRC = join(__dirname, "..", "src");

/** Every .ts/.tsx file under src, with its path relative to the project. */
function sources(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip comments, so prose about a variable is not mistaken for reading it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("nothing reaches past keys.ts", () => {
  const CREDENTIALS = [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ];

  it("reads every Supabase credential in exactly one module", () => {
    const offenders = sources()
      .filter((f) => !f.endsWith(join("lib", "supabase", "keys.ts")))
      .filter((f) => {
        const body = code(readFileSync(f, "utf8"));
        return CREDENTIALS.some((name) => body.includes(name));
      })
      .map((f) => f.replace(SRC + "/", "src/"));

    // A file here is not necessarily broken — but it has opted out of the
    // rename handling, and that is exactly how sign-in broke while every
    // other page worked.
    expect(offenders).toEqual([]);
  });
});

describe("either spelling of a key", () => {
  const saved = { ...process.env };
  const clear = () => {
    for (const k of Object.keys(process.env)) {
      if (k.includes("SUPABASE")) delete process.env[k];
    }
  };
  const restore = () => {
    clear();
    for (const [k, v] of Object.entries(saved)) if (k.includes("SUPABASE")) process.env[k] = v;
  };

  it("takes the browser key under the name today's dashboard gives it", () => {
    clear();
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    expect(publishableKey()).toBe("sb_publishable_x");
    restore();
  });

  it("still takes it under the name it used to have", () => {
    clear();
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOi";
    expect(publishableKey()).toBe("eyJhbGciOi");
    restore();
  });

  it("takes the secret key under either name", () => {
    clear();
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    expect(secretKey()).toBe("sb_secret_x");
    clear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJzZXJ2";
    expect(secretKey()).toBe("eyJzZXJ2");
    restore();
  });

  it("names what is missing, and where to find it", () => {
    clear();
    const said = whatIsMissing()!;
    expect(said).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(said).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    // Whoever reads this is setting the product up for the first time, so it
    // has to say where the value comes from and how to skip needing one.
    expect(said).toContain("Project Settings");
    expect(said).toContain("DEMO_MODE=1");
    restore();
  });

  it("is satisfied by either spelling, not only the new one", () => {
    clear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOi";
    expect(whatIsMissing()).toBeNull();
    expect(projectUrl()).toBe("https://x.supabase.co");
    restore();
  });
});
