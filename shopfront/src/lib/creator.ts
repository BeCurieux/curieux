/**
 * Who a shop was made for, when it was made for somebody's audience.
 *
 * A creator shop is the same object as a merchant shop — same catalogue, same
 * `ShopConfig`, same renderer, same checkout. The only new fact is attribution:
 * this shop was built for Ana's people, Ana is credited on it, and the funnel
 * events under its slug are therefore Ana's numbers. That is the whole feature,
 * and keeping it that small is what keeps it from becoming a second product.
 *
 * **The creator is not in `ShopConfig`, and that placement is the decision in
 * this file.** `ShopConfig` is the thing the model fills. A field there is a
 * field a model can invent, and an invented credit is a real person's name
 * attached to a shop they never saw — the worst failure this system could have,
 * and one no amount of prompt care would reliably prevent. So attribution is a
 * publish-time argument, supplied by whoever ran the command, sitting on the
 * shop record next to the plan and the slug. The merchandiser is never told and
 * cannot make it up.
 *
 * What a creator shop is *merchandised* for still comes from the prompt, like
 * everything else: "for Ana's followers, who came for the linen and stay for
 * the sale rail" is a sentence, and sentences are the interface.
 */

import { z } from "zod";

/**
 * The handle, without the at-sign.
 *
 * Deliberately the intersection of what Instagram and TikTok allow rather than
 * the union: dots and underscores in, everything else out, no leading or
 * trailing punctuation. A handle that round-trips through both is one a creator
 * can be asked for once.
 *
 * One character is legal, which looks like an oversight and is not: single-
 * letter handles exist on both platforms, and a length floor invented for
 * tidiness would refuse a real person by name.
 */
export const HANDLE_SHAPE = /^[a-z0-9](?:[a-z0-9._]{0,28}[a-z0-9])?$/;

export const Creator = z.object({
  /** Lowercase, no `@`. Normalise with `readCreator` rather than by hand. */
  handle: z.string().regex(HANDLE_SHAPE, "A handle is 1–30 characters of letters, numbers, dots or underscores."),
  /** How they are credited on the page. Their name, not their handle again. */
  name: z.string().min(1).max(60),
  /** Where the credit links. Their profile, usually. */
  url: z.string().url().optional(),
});

export type Creator = z.infer<typeof Creator>;

export interface CreatorInput {
  handle: string;
  name?: string | undefined;
  url?: string | undefined;
}

/**
 * Read a creator off however it was typed.
 *
 * `@ana.ruiz`, `ana.ruiz`, `https://instagram.com/ana.ruiz/` and
 * `instagram.com/ana.ruiz` all name the same person, and a CLI that accepted
 * only one of them would be a CLI whose first argument has to be looked up.
 *
 * Throws rather than falling back to something plausible. Publishing under a
 * handle nobody meant is a public, permanent mistake, and a mangled handle is
 * exactly the kind that would go unnoticed.
 */
export function readCreator(input: CreatorInput): Creator {
  const handle = normaliseHandle(input.handle);
  const name = input.name?.trim();

  return Creator.parse({
    handle,
    // Falling back to the handle is honest — it is a name they chose and it is
    // what a credit reads as anyway when nothing better was given.
    name: name && name.length > 0 ? name : handle,
    ...(input.url ? { url: input.url } : {}),
  });
}

/** `@Ana.Ruiz`, a profile URL, or the bare thing → `ana.ruiz`. */
export function normaliseHandle(input: string): string {
  const trimmed = input.trim();

  // A pasted profile URL: take the first path segment. Anything deeper is a
  // post or a reel, and its author is not derivable from the path.
  const fromUrl = /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:instagram|tiktok|youtube|threads)\.[a-z.]+\/(.+)/i.exec(trimmed);
  const candidate = fromUrl?.[1] ?? trimmed;

  return candidate
    .split(/[/?#]/)[0]!
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
}

/**
 * The slug a creator shop wants when nobody asked for one.
 *
 * Brand first, because the shop is the brand's product and the URL is read as
 * the brand's: `kelpandcotton-ana-ruiz` says whose shop it is and whose people
 * it is for, in that order. `allocateSlug` still has the last word on
 * collisions and length.
 */
export function creatorSlugSeed(brandName: string, creator: Creator): string {
  return `${brandName} ${creator.handle}`;
}

/**
 * How the credit reads on the page.
 *
 * "Chosen by" rather than "curated by": one of them is a word people say. It
 * claims only what happened — a person picked these — and specifically does not
 * claim a partnership, an endorsement or a commission, none of which this
 * system knows anything about.
 */
export function creditLine(creator: Creator): string {
  return `Chosen by ${creator.name}`;
}
