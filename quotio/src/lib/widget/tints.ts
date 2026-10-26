// Colouring a grid of repeated pictures.
//
// When one picture dominates an answer grid — five beds for "how many
// bedrooms?", plus a question mark for "Not sure" — the repeats get different
// colours so the grid has some life in it. A set that genuinely varies
// (Apartment / House / Office) is left alone, because recolouring those would
// be decoration fighting the meaning.
//
// This lived inline in the renderer, which is how the template cards ended up
// showing three identical cakes for a question the real widget draws in three
// colours. Data only, no JSX, so the renderer and the miniature can share it.

import type { IllustrationKey } from "@/lib/widget/illustrations";

/** The rotation. Six is enough — no answer grid is longer than that. */
export const ART_TINTS = ["#73DDB5", "#FFC857", "#FF806F", "#A9A9F7", "#5FBFB0", "#F5B971"];

/** Below this many copies it isn't a pattern, it's a coincidence. */
const REPEAT_THRESHOLD = 3;

/**
 * Which picture, if any, repeats often enough to be worth recolouring.
 *
 * Must be given the *whole* option list. Handing it a slice — the miniature
 * only draws the first three answers — can flip the answer, and then the card
 * and the widget disagree about the same question.
 */
export function repeatedIllustration(
  options: Array<{ illustration?: IllustrationKey }>
): IllustrationKey | null {
  const tally = new Map<IllustrationKey, number>();
  for (const option of options) {
    if (option.illustration) {
      tally.set(option.illustration, (tally.get(option.illustration) ?? 0) + 1);
    }
  }

  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= REPEAT_THRESHOLD ? top[0] : null;
}

/**
 * The colour for one answer, or undefined to leave the drawing as authored.
 *
 * `index` is the option's position in the full list, so answer four is the
 * same colour wherever it's drawn.
 */
export function tintFor(
  illustration: IllustrationKey | undefined,
  index: number,
  repeated: IllustrationKey | null
): string | undefined {
  if (!illustration || illustration !== repeated) return undefined;
  return ART_TINTS[index % ART_TINTS.length];
}
