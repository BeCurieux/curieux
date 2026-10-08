/**
 * The only file that talks to a model.
 *
 * It drafts. It decides nothing: every draft goes back through `check.ts`
 * in `write.ts`, and one that says something the listing does not is replaced
 * by a template however well it reads.
 */

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Facts } from "./facts.js";
import { ANGLES, LIMITS } from "./types.js";

export const MODEL = "claude-opus-5-5";

/** Looser than `AdScriptSchema` on purpose: an over-long caption should fail
 *  that one ad in `write.ts`, not throw away all three at parse time. */
const DraftSchema = z.object({
  ads: z.array(
    z.object({
      angle: z.enum(ANGLES),
      hook: z.string(),
      hookImage: z.number().int(),
      scenes: z.array(z.object({ caption: z.string(), image: z.number().int() })),
      cta: z.string(),
    }),
  ),
});

export type Drafter = (facts: Facts) => Promise<unknown[]>;

const SYSTEM = `You write captions for short vertical video ads (TikTok, Instagram Reels, Facebook) for small Etsy and Shopify sellers. Each ad is a 10–15 second slideshow of the seller's own product photos with one caption per photo.

Write three ads, one per angle:
- showcase: stop the scroll and show the product off.
- gift: position it as a gift.
- details: slow down on what makes it well made or specific.

Each ad has a hook (at most ${LIMITS.hook} characters, shown big over the first photo), ${LIMITS.minScenes} to ${LIMITS.maxScenes} scenes (each caption at most ${LIMITS.caption} characters), and a call to action (at most ${LIMITS.cta} characters). Captions are read in about two seconds, so keep them short and concrete. Write like a person, not a brochure: no hashtags, no emoji, no exclamation-mark pileups.

The one rule that matters most: say only what the listing says. Do not add materials, sizes, numbers, discounts, shipping promises, reviews, popularity ("best-seller", "loved by thousands"), provenance ("handmade", "made in…"), or certifications unless the listing states them. If the listing is thin, write less rather than inventing. Every ad you write is checked against the listing, and one that claims anything it doesn't say is thrown away.

Photos are numbered from 0. Choose which photo each scene and hook sits on, varying them across the three ads where there is more than one photo.`;

function prompt(f: Facts): string {
  return [
    `Product: ${f.title}`,
    f.shop ? `Shop: ${f.shop}` : null,
    f.price ? `Price: ${f.price}` : "Price: not shown — do not mention price.",
    `Sold on: ${f.marketplace === "etsy" ? "Etsy" : "the seller's own online shop"}`,
    `Photos: ${f.imageCount} (numbered 0 to ${f.imageCount - 1})`,
    "",
    "Listing description:",
    f.description || "(none)",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function claudeDrafter(client = new Anthropic()): Drafter {
  return async (facts) => {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Ad copy is a short, well-specified job; the effort is in the rules,
      // not the reasoning.
      output_config: { effort: "low", format: betaZodOutputFormat(DraftSchema) },
      // If a safety classifier declines (a listing for a knife, say), the API
      // retries on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: prompt(facts) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return [];
    return res.parsed_output.ads;
  };
}
