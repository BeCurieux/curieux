import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The product speaks US English.
 *
 * That isn't a style preference, it's a consequence: plans are priced in USD
 * (lib/plans.ts) and a widget's default currency is USD (widget/schema.ts).
 * Dollar prices next to "enquiries" reads as a product that hasn't decided
 * where it lives.
 *
 * Copy drifts back one string at a time — somebody types "colour" into a hint
 * six months from now and nothing objects. So this objects.
 *
 * The check runs over *strings a user can reach* rather than over the file:
 * quoted literals, template literals and JSX text. Identifiers are deliberately
 * out of scope. `brandColour`, `ColourField` and `hexColourSchema` are names in
 * the codebase, not words on a screen, and renaming them would be a large
 * mechanical diff with nothing at the end of it for anyone using the product.
 */

const SOURCE = path.join(__dirname, "..", "src");

/** British spelling → what to write instead. */
const BRITISH: Array<[RegExp, string]> = [
  [/\bcolours?\b/i, "color"],
  [/\bcolour(ed|ing|ful)\b/i, "color…"],
  [/\benquir(y|ies|e|ed|ing)\b/i, "lead / inquiry"],
  [/\bmaths\b/i, "math"],
  [/\bcatalogue\b/i, "catalog"],
  [/\bcentre[ds]?\b/i, "center"],
  [/\bfavourite/i, "favorite"],
  [/\bbehaviour/i, "behavior"],
  [/\blicence\b/i, "license"],
  [/\bwhilst\b/i, "while"],
  [/\bamongst\b/i, "among"],
  [/\b(personalis|customis|organis|recognis|optimis|apologis|analys)(e|ed|es|ing|ation)\b/i, "…ize / …yze"],
];

/**
 * Strings a reader could end up looking at: quoted literals, template
 * literals, and the text between JSX tags.
 *
 * Comments and import statements come out first. A comment is a note to the
 * next developer, and an import path is a filename — `lib/templates/catalogue`
 * stays spelled the way the file on disk is spelled.
 */
function userFacingStrings(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // Not `https://` — only a `//` that isn't preceded by a colon.
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/^\s*import[^;]*;?/gm, " ");

  const found: string[] = [];
  const patterns = [
    /"((?:[^"\\\n]|\\.)*)"/g,
    /'((?:[^'\\\n]|\\.)*)'/g,
    /`((?:[^`\\]|\\.)*)`/g,
    // JSX text: between a closing bracket and the next opening one, with at
    // least one letter in it so `}{` and whitespace don't count.
    />([^<>{}]*[A-Za-z][^<>{}]*)</g,
  ];
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the product speaks US English", () => {
  const files = sourceFiles(SOURCE);

  it("has source to check", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("uses no British spelling in anything a user can read", () => {
    const offences: string[] = [];

    for (const file of files) {
      const relative = path.relative(path.join(__dirname, ".."), file);
      for (const text of userFacingStrings(readFileSync(file, "utf8"))) {
        for (const [pattern, instead] of BRITISH) {
          const hit = text.match(pattern);
          if (hit) offences.push(`${relative}: "${hit[0]}" → ${instead}   (in: ${text.trim().slice(0, 60)})`);
        }
      }
    }

    expect(offences, `\n${offences.join("\n")}\n`).toEqual([]);
  });

  it("actually catches a British spelling", () => {
    // Without this the test above passes just as happily when the extraction
    // is broken and finds no strings at all.
    const sample = `
      const label = "Brand colour";
      const hint = \`\${x} colour picker\`;
      export function A() { return <p>Qualify enquiries first</p>; }
    `;
    const strings = userFacingStrings(sample);
    const caught = strings.filter((s) => BRITISH.some(([p]) => p.test(s)));
    expect(caught).toHaveLength(3);
  });

  it("leaves identifiers, comments and import paths alone", () => {
    const sample = `
      import { TEMPLATES } from "@/lib/templates/catalogue";
      // The colour of the thing, centred.
      /* enquiries go here */
      const brandColour = theme.colour;
      const url = "https://example.com/x";
    `;
    const strings = userFacingStrings(sample);
    expect(strings.filter((s) => BRITISH.some(([p]) => p.test(s)))).toEqual([]);
  });
});
