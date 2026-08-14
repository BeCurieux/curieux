"use client";

/**
 * What to do when a photograph does not arrive.
 *
 * The renderer already has a considered answer for a product with no
 * photograph: the initial set huge in the display face, because a grey box with
 * a broken-image glyph is the clearest possible tell that a page was generated.
 * It had no answer at all for the other case — a photograph the merchant *has*,
 * whose URL no longer resolves.
 *
 * Found the first time this ran against a real store. Every plate rendered the
 * browser's broken-image icon with the alt text spilling across it, and the
 * hero's white headline sat unreadable on a pale plate, because the scrim that
 * makes white legible is a bet on there being a photograph under it. Both are
 * the same missing distinction: a URL that is absent and a URL that is dead
 * look identical to a shopper and completely different to this code.
 *
 * A merchant deletes a product photo, a CDN path changes, hotlink protection
 * turns on. This is not an edge case, it is a Tuesday.
 *
 * One delegated listener rather than a handler on every image, for the same
 * reason `Funnel.tsx` delegates its clicks: the alternative turns a tree of
 * server components into a client tree to catch an event that almost never
 * fires. `error` does not bubble, so this listens in the capture phase, which
 * is the whole reason a global listener can see it at all.
 */

import { useEffect } from "react";

export function BrokenImagery() {
  useEffect(() => {
    const mark = (image: HTMLImageElement) => {
      // The hero and the cards get told separately, because they recover
      // differently: a card falls back to its initial, the hero falls back to
      // the whole no-photograph treatment.
      image.closest(".plate")?.setAttribute("data-broken", "true");
      image.closest(".hero")?.setAttribute("data-broken", "true");
    };

    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement) mark(target);
    };

    document.addEventListener("error", onError, true);

    // Images that failed before this listener existed report nothing further —
    // `complete` with no intrinsic width is the only evidence left that one of
    // them died, and on a fast cache that is most of them.
    for (const image of document.querySelectorAll("img")) {
      if (image.complete && image.naturalWidth === 0) mark(image);
    }

    return () => document.removeEventListener("error", onError, true);
  }, []);

  return null;
}
