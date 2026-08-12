"use client";

/**
 * The one interactive thing on the page.
 *
 * A discount code exists to be typed into a checkout on another site, which
 * means every shopper who uses it has to select it accurately on a phone. A
 * press-to-copy chip removes the only genuinely fiddly interaction a mini-shop
 * has, so it earns the single client component the page ships.
 *
 * It stays a `<button>` with the code as its own text: if the JavaScript never
 * arrives the code is still there to be read and selected by hand.
 */

import { useEffect, useState } from "react";
import { CopyMark } from "./marks";

export function OfferCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="offer-code"
      data-copied={copied}
      // Announced rather than only shown, because the confirmation is a colour
      // change on a 15px glyph and that is not a confirmation for everyone.
      aria-label={copied ? `Copied discount code ${code}` : `Copy discount code ${code}`}
      onClick={() => {
        navigator.clipboard
          ?.writeText(code)
          .then(() => setCopied(true))
          // A clipboard write can be refused by permissions or an in-app
          // browser. The code is on screen either way, so this fails quietly
          // rather than showing a confirmation that did not happen.
          .catch(() => undefined);
      }}
    >
      <span>{code}</span>
      <CopyMark copied={copied} />
      <span aria-live="polite" className="visually-hidden">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
