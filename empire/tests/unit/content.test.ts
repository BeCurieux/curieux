import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/content/catalogue";
import { METHODOLOGY } from "@/content/methodology";

const register = JSON.parse(readFileSync("content/register.json", "utf8")) as {
  assets: { id: string; source_reviewed: boolean; original_document: string }[];
};
const ids = new Set(register.assets.map((a) => a.id));

describe("content register", () => {
  it("every methodology and catalogue entry points at a registered asset", () => {
    for (const method of Object.values(METHODOLOGY))
      for (const id of method.sources) expect(ids, id).toContain(id);
    for (const item of CATALOGUE) expect(ids, item.slug).toContain(item.slug);
  });

  it("a method only claims to come from source once that source has been reviewed", () => {
    for (const [module, method] of Object.entries(METHODOLOGY)) {
      if (method.status === "interim") continue;
      for (const id of method.sources) {
        const asset = register.assets.find((a) => a.id === id)!;
        expect(asset.source_reviewed, `${module} cites ${id}`).toBe(true);
      }
    }
  });
});
