/**
 * Three ads for a product: the model's draft where it holds up, a template
 * where it does not, and always exactly one per angle.
 */

import { fitImages, problems } from "./check.js";
import type { Drafter } from "./claude.js";
import type { Facts } from "./facts.js";
import { templateScript } from "./templates.js";
import { AdScriptSchema, ANGLES, type Written } from "./types.js";

export type WriteReport = {
  ads: Written[];
  /** Why each discarded draft was discarded. Logged, not shown: a seller
   *  does not need to know a model tried to call their mug "handmade". */
  rejected: { angle: string; why: string[] }[];
  /** The drafter threw (no key, rate limit, outage). The templates ran. */
  drafterError?: string;
};

export async function writeAds(facts: Facts, drafter?: Drafter): Promise<WriteReport> {
  const rejected: WriteReport["rejected"] = [];
  let drafts: unknown[] = [];
  let drafterError: string | undefined;

  if (drafter) {
    try {
      drafts = await drafter(facts);
    } catch (e) {
      drafterError = e instanceof Error ? e.message : String(e);
    }
  }

  const ads = ANGLES.map((angle): Written => {
    const draft = drafts.find((d) => (d as { angle?: unknown })?.angle === angle);
    if (draft) {
      const parsed = AdScriptSchema.safeParse(draft);
      if (parsed.success) {
        const script = fitImages(parsed.data, facts.imageCount);
        const why = problems(script, facts);
        if (why.length === 0) return { ...script, by: "claude" };
        rejected.push({ angle, why });
      } else {
        rejected.push({ angle, why: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
    }
    return { ...fitImages(templateScript(angle, facts), facts.imageCount), by: "template" };
  });

  return { ads, rejected, ...(drafterError ? { drafterError } : {}) };
}
