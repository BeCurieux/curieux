import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { splitFrontmatter } from "@/lib/content/load";

// The public pages' copy lives in content/pages as markdown (SPEC.md → Build
// order, step 6), so the founder edits words without touching code.
// Frontmatter: title, description, draft, and page-specific fields.
// `draft: true` puts a visible "Draft copy" notice on the page until the
// final copy replaces it (the launch check refuses drafts).
//
// Prices are never typed into the copy. Write {{price:module-0}},
// {{price:course}}, {{price:course-with-credit}}, {{price:founding}} or
// {{price:benchmark-pack}}; {{founding_places}} and {{refund_days}} too.
// They're filled in from the database, in the visitor's currency.

const ROOT = path.join(process.cwd(), "content", "pages");

export interface PageCopy {
  title: string;
  description: string;
  draft: boolean;
  data: Record<string, unknown>;
  body: string;
}

export async function loadPage(name: string): Promise<PageCopy> {
  const source = await readFile(path.join(ROOT, `${name}.md`), "utf8");
  const { data, body } = splitFrontmatter(source);
  const meta = (data ?? {}) as Record<string, unknown>;
  return {
    title: String(meta.title ?? ""),
    description: String(meta.description ?? ""),
    draft: meta.draft === true,
    data: meta,
    body: body.trim(),
  };
}

/** Replaces {{token}}s; an unknown token is left visible so it gets noticed. */
export function fillTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w:-]+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}
