import { z } from "zod";

/**
 * One ad: a hook over the first photo, two to four captioned scenes, and an
 * end card. Short on purpose — these are 10–15 second vertical videos, and
 * every caption has to be readable in the time its scene is on screen.
 */

export const ANGLES = ["showcase", "gift", "details"] as const;
export type Angle = (typeof ANGLES)[number];

export const ANGLE_LABEL: Record<Angle, string> = {
  showcase: "Scroll-stopper",
  gift: "Gift idea",
  details: "Close-up details",
};

export const LIMITS = { hook: 48, caption: 64, cta: 28, minScenes: 2, maxScenes: 4 } as const;

export const SceneSchema = z.object({
  caption: z.string().min(1).max(LIMITS.caption),
  /** Index into the product's photos. */
  image: z.number().int().min(0),
});

export const AdScriptSchema = z.object({
  angle: z.enum(ANGLES),
  hook: z.string().min(1).max(LIMITS.hook),
  /** The photo the hook sits on. */
  hookImage: z.number().int().min(0),
  scenes: z.array(SceneSchema).min(LIMITS.minScenes).max(LIMITS.maxScenes),
  cta: z.string().min(1).max(LIMITS.cta),
});

export type Scene = z.infer<typeof SceneSchema>;
export type AdScript = z.infer<typeof AdScriptSchema>;

/** Where a script came from, shown to the seller so "AI-written" is never a
 *  surprise and a template is never passed off as anything else. */
export type Written = AdScript & { by: "claude" | "template" };
